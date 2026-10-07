//! Theme and language picked in the installer. The page keeps both in its localStorage, which
//! the installer cannot reach, so it leaves them in a file that the first window takes once.
use serde::Deserialize;

const FILE_NAME: &str = "installer-preferences.json";

#[derive(Deserialize)]
struct Preferences {
    theme: String,
    locale: String,
}

/// A script that stores the installer's choices in localStorage before the page reads them,
/// or None when there is nothing (left) to hand over. The file is gone once read.
pub fn take_script() -> Option<String> {
    let path = cursor_server::config::managed_data_dir().ok()?.join(FILE_NAME);
    let text = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    let preferences: Preferences = serde_json::from_str(&text).ok()?;
    let theme = matches!(preferences.theme.as_str(), "default-dark" | "default-light")
        .then(|| serde_json::to_string(&preferences.theme).expect("string serializes"))?;
    let locale = match preferences.locale.as_str() {
        "zh-CN" | "en-US" => format!(
            "localStorage.setItem(\"cursor-byok.locale\", {});",
            serde_json::to_string(&preferences.locale).expect("string serializes")
        ),
        _ => "localStorage.removeItem(\"cursor-byok.locale\");".into(),
    };
    // Once per window: a reload in the same window must not undo a change made since.
    Some(format!(
        "if (!sessionStorage.getItem(\"kaeru.installer\")) {{ \
           localStorage.setItem(\"cursor-byok.theme\", {theme}); {locale} \
           sessionStorage.setItem(\"kaeru.installer\", \"1\"); }}"
    ))
}
