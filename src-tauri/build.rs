fn main() {
    // Both the desktop app and the Android app need tauri-build: it generates the
    // platform glue and sets the `desktop` / `mobile` cfg that the rest of the
    // crate keys off. Skipping it for `mobile` is not an option — without the
    // build script the mobile cfg never gets set and the Android side is inert.
    // A `standalone-server` build has no tauri at all and must not call it.
    let tauri_target = std::env::var_os("CARGO_FEATURE_DESKTOP").is_some()
        || std::env::var_os("CARGO_FEATURE_MOBILE").is_some();
    if tauri_target {
        tauri_build::build();
    }

    // The library test target explicitly links Tauri's generated manifest resource.
    // Keep this as a search path only so application binaries do not link it twice.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let out_dir = std::env::var("OUT_DIR").expect("Cargo must set OUT_DIR");
        println!("cargo:rustc-link-search=native={out_dir}");
    }
}
