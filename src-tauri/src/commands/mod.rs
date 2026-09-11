pub mod batch_commands;
pub mod disk_space_commands;
pub mod external_client_import_commands;
pub mod import_commands;
// `imagegen::commands` is itself desktop-only, so the re-export has to follow it.
#[cfg(feature = "desktop")]
pub mod imagegen_commands {
    pub use crate::imagegen::commands::*;
}
pub mod notification_commands;
pub mod platform_commands;
pub mod route_credential_commands;
// Picks files through `tauri-plugin-dialog`, which the mobile build does not link.
#[cfg(feature = "desktop")]
pub mod route_credential_transfer_commands;
pub mod route_pool_commands;
pub mod route_proxy_commands;
// Every command here drives the desktop local-HTTPS/root-CA feature, and the
// module opens a directory through `tauri-plugin-opener`; both are desktop-only.
#[cfg(feature = "desktop")]
pub mod route_proxy_https_commands;
pub mod session_commands;
pub mod settings_commands;
pub mod target_commands;
// Drives a PTY, so it rides the `terminal` feature rather than `desktop`.
#[cfg(feature = "terminal")]
pub mod terminal_commands;
pub mod usage_stats_commands;
// Kept for the mobile build: it carries mobile pairing, the tailscale status and
// the listener config commands the Android panel needs. Only its opener call is
// gated; see the `start_tailscale_login` body.
pub mod web_service_commands;
