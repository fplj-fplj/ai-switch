//! Registration for the Android-side runtime plugin.
//!
//! The panel invokes `plugin:pool-runtime|<command>` directly and Tauri routes it
//! to the Kotlin class, so there are no wrapper methods here — those exist only for
//! Rust calling into Kotlin, which nothing does. All this file does is tell Tauri
//! which class backs the name.

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

/// Where the plugin lives on the Android side. The package is the Android
/// application id, which is the Tauri identifier with the hyphen escaped — the same
/// transformation `tauri-build` applies when it writes the Gradle project.
#[cfg(target_os = "android")]
const ANDROID_PACKAGE: &str = "io.xyito.ai_switch";
#[cfg(target_os = "android")]
const ANDROID_CLASS: &str = "PoolRuntimePlugin";

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("pool-runtime")
        .setup(|_app, _api| {
            // Android only: the handle is what instantiates the Kotlin class, and
            // there is nothing to instantiate anywhere else. The commands themselves
            // are guarded by `isMobileApp()` in the panel, so a desktop build never
            // calls into this.
            #[cfg(target_os = "android")]
            let _handle = _api.register_android_plugin(ANDROID_PACKAGE, ANDROID_CLASS)?;
            Ok(())
        })
        .build()
}
