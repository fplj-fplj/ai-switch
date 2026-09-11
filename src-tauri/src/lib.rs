mod adapters;
mod app_state;
// The command layer is what makes the panel usable, so the Android app needs it
// too. Only a handful of the modules inside are genuinely desktop-only; see
// `commands/mod.rs`. A `standalone-server` build has no IPC surface at all.
#[cfg(any(feature = "desktop", feature = "mobile"))]
mod commands;
mod config_writer;
mod core;
mod database;
mod error;
mod imagegen;
mod importers;
mod mcp;
mod models;
mod paths;
mod saas;
mod security;
pub mod server;
mod services;
mod session_manager;
mod skills;
#[cfg(feature = "terminal")]
mod terminal_manager;
mod web;

#[cfg(feature = "desktop")]
include!("desktop.rs");

#[cfg(feature = "mobile")]
include!("mobile.rs");

// rfd uses TaskDialogIndirect, which requires the Common Controls v6 manifest.
// Tauri links its generated resource into application binaries, but not lib tests.
#[cfg(all(test, target_os = "windows", feature = "desktop"))]
#[link(name = "resource", kind = "static")]
unsafe extern "C" {}
