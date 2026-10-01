fn main() {
    // tauri-build only watches tauri.conf.json, capabilities and permissions, so a changed
    // icon would otherwise keep the old one baked into the Windows executable resources.
    println!("cargo:rerun-if-changed=icons");
    let manifest = tauri_build::AppManifest::new().commands(&["open_terminal_with_command"]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to build Tauri application")
}
