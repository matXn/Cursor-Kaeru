//! Cursor Kaeru's acrylic installer. The page in `../src` asks; this side finds where the app
//! is or should go, and installs by running the embedded NSIS package silently:
//!
//! ```text
//! plan ──► page (welcome) ──► install(dir, shortcut) ──► temp\setup.exe /S /D=dir ──► done ──► launch
//! ```
//!
//! The NSIS package keeps doing the real work (files, Start menu, uninstaller, closing a running
//! app), so this program never touches the install itself.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use serde::{Deserialize, Serialize};

const PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/payload.exe"));
/// Names the NSIS package uses; see `bundle.windows.nsis` and productName in the desktop app.
const PRODUCT_NAME: &str = "Cursor Kaeru";
const MAIN_BINARY: &str = "cursor-byok-desktop.exe";

#[derive(Serialize)]
struct Plan {
    version: String,
    install_dir: String,
    installed_version: Option<String>,
}

#[tauri::command]
fn plan(app: tauri::AppHandle) -> Plan {
    let previous = registry::previous_install();
    Plan {
        version: app.package_info().version.to_string(),
        install_dir: previous
            .dir
            .unwrap_or_else(|| default_dir().to_string_lossy().into_owned()),
        installed_version: previous.version,
    }
}

/// A folder chosen in the system picker; the app goes into its own `Cursor Kaeru` folder there.
#[tauri::command]
async fn choose_dir(current: String) -> Option<String> {
    let start = Path::new(&current)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(default_dir);
    let chosen = rfd::AsyncFileDialog::new().set_directory(start).pick_folder().await?;
    let mut dir = chosen.path().to_path_buf();
    if dir.file_name().is_none_or(|name| name != PRODUCT_NAME) {
        dir.push(PRODUCT_NAME);
    }
    Some(dir.to_string_lossy().into_owned())
}

/// The second page's choices.
#[derive(Deserialize)]
struct Options {
    desktop_shortcut: bool,
    autostart: bool,
    /// `default-dark` or `default-light`, as the app names its themes.
    theme: String,
    /// `zh-CN` or `en-US`.
    locale: String,
}

#[tauri::command]
async fn install(dir: String, options: Options) -> Result<(), String> {
    if PAYLOAD.is_empty() {
        return Err("this build carries no installer package; build it with `pnpm run bundle`".into());
    }
    let dir = PathBuf::from(dir.trim());
    if !dir.is_absolute() {
        return Err(format!("not a full path: {}", dir.display()));
    }
    tauri::async_runtime::spawn_blocking(move || run_payload(&dir, &options))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn launch(dir: String) -> Result<(), String> {
    Command::new(Path::new(dir.trim()).join(MAIN_BINARY))
        .spawn()
        .map(drop)
        .map_err(|error| error.to_string())
}

fn run_payload(dir: &Path, options: &Options) -> Result<(), String> {
    let package = std::env::temp_dir().join(format!("cursor-kaeru-setup-{}.exe", std::process::id()));
    fs::write(&package, PAYLOAD).map_err(|error| format!("cannot unpack the installer: {error}"))?;
    let status = silent_install(&package, dir);
    let _ = fs::remove_file(&package);
    let status = status.map_err(|error| format!("cannot start the installer: {error}"))?;
    if !status.success() {
        return Err(format!("the installer exited with code {}", status.code().unwrap_or(-1)));
    }
    if !options.desktop_shortcut {
        // NSIS's own switch for this (/NS) also drops the Start menu entry, so remove just this one.
        if let Some(desktop) = dirs::desktop_dir() {
            let _ = fs::remove_file(desktop.join(format!("{PRODUCT_NAME}.lnk")));
        }
    }
    registry::set_autostart(&dir.join(MAIN_BINARY), options.autostart)
        .map_err(|error| format!("cannot set up starting with Windows: {error}"))?;
    hand_over_preferences(options).map_err(|error| format!("cannot save the theme and language: {error}"))
}

/// The app keeps theme and language in its page storage; it takes this file once on first open.
/// See `installer_preferences.rs` in the desktop app.
fn hand_over_preferences(options: &Options) -> std::io::Result<()> {
    let theme = if options.theme == "default-light" { "default-light" } else { "default-dark" };
    let locale = if options.locale == "en-US" { "en-US" } else { "zh-CN" };
    let data = dirs::home_dir().unwrap_or_default().join(".cursor-byok-v3");
    fs::create_dir_all(&data)?;
    let json = format!(
        "{{\"theme\":\"{theme}\",\"locale\":\"{locale}\"}}"
    );
    fs::write(data.join("installer-preferences.json"), json)
}

/// `/S` runs NSIS without its pages; `/D=` must come last and unquoted, spaces and all.
#[cfg(windows)]
fn silent_install(package: &Path, dir: &Path) -> std::io::Result<std::process::ExitStatus> {
    use std::os::windows::process::CommandExt;
    Command::new(package)
        .arg("/S")
        .raw_arg(format!("/D={}", dir.display()))
        .status()
}

#[cfg(not(windows))]
fn silent_install(_package: &Path, _dir: &Path) -> std::io::Result<std::process::ExitStatus> {
    Err(std::io::Error::other("the installer runs on Windows only"))
}

/// Where the NSIS package installs for the current user when nothing says otherwise.
fn default_dir() -> PathBuf {
    dirs::data_local_dir().unwrap_or_default().join(PRODUCT_NAME)
}

mod registry {
    pub struct PreviousInstall {
        pub dir: Option<String>,
        pub version: Option<String>,
    }

    /// The folder and version a previous install left in the keys the NSIS package writes.
    #[cfg(windows)]
    pub fn previous_install() -> PreviousInstall {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let user = RegKey::predef(HKEY_CURRENT_USER);
        let read = |key: &str, value: &str| {
            user.open_subkey(key)
                .and_then(|key| key.get_value::<String, _>(value))
                .ok()
                .map(|value| value.trim_matches('"').to_owned())
                .filter(|value| !value.is_empty())
        };
        let uninstall = format!(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{}", super::PRODUCT_NAME);
        PreviousInstall {
            dir: read(&format!(r"Software\cursorbyok\{}", super::PRODUCT_NAME), "")
                .or_else(|| read(&uninstall, "InstallLocation")),
            version: read(&uninstall, "DisplayVersion"),
        }
    }

    /// The Run value the app's autostart plugin writes and reads (see tauri-plugin-autostart):
    /// named after the product, `<exe> --autostart`.
    #[cfg(windows)]
    pub fn set_autostart(exe: &std::path::Path, enabled: bool) -> std::io::Result<()> {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let (run, _) = RegKey::predef(HKEY_CURRENT_USER)
            .create_subkey(r"SoftwareMicrosoftWindowsCurrentVersionRun")?;
        if enabled {
            run.set_value(super::PRODUCT_NAME, &format!("{} --autostart", exe.display()))
        } else {
            match run.delete_value(super::PRODUCT_NAME) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
                result => result,
            }
        }
    }

    #[cfg(not(windows))]
    pub fn set_autostart(_exe: &std::path::Path, _enabled: bool) -> std::io::Result<()> {
        Ok(())
    }

    #[cfg(not(windows))]
    pub fn previous_install() -> PreviousInstall {
        PreviousInstall { dir: None, version: None }
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![plan, choose_dir, install, launch])
        .run(tauri::generate_context!())
        .expect("run the Cursor Kaeru installer");
}
