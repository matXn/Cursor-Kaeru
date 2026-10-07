use std::{env, fs, path::PathBuf};

/// The desktop app's NSIS installer that this setup carries, copied here by `scripts/bundle.mjs`.
const PAYLOAD: &str = "payload/cursor-kaeru-nsis.exe";

fn main() {
    // Embed the payload from OUT_DIR so the workspace still builds without one; such a build
    // reports the missing payload when asked to install.
    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("payload.exe");
    match fs::read(PAYLOAD) {
        Ok(bytes) => fs::write(&out, bytes),
        Err(_) => fs::write(&out, []),
    }
    .expect("write payload into OUT_DIR");
    println!("cargo:rerun-if-changed={PAYLOAD}");

    let manifest = tauri_build::AppManifest::new().commands(&["plan", "choose_dir", "install", "launch"]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to build Tauri application")
}
