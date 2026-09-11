//! Which agent CLI backs a platform id, and whether it is installed.
//!
//! These used to live in `terminal_manager`, but the web handler layer needs
//! them (`services/agent_launch_service.rs` feeds the Vibe screen's dropdowns)
//! and that layer compiles on Android, where there is no terminal manager to
//! import them from. Everything here is pure — no PTY, no spawning — so it can
//! stay available to every build.

use std::path::PathBuf;

/// Maps an agent platform id to the CLI entry point AI Switch spawns for it.
pub fn agent_program_name(platform: &str) -> Option<&'static str> {
    match platform.trim() {
        "codex" => Some("codex"),
        "claude" => Some("claude"),
        "grok" => Some("grok"),
        "gemini" => Some("gemini"),
        "opencode" => Some("opencode"),
        "openclaw" => Some("openclaw"),
        "hermes" => Some("hermes"),
        _ => None,
    }
}

/// Only the CLIs whose `--model` flag has been verified take an explicit model
/// argument; the rest keep whatever their own config selects.
pub fn agent_supports_model_flag(platform: &str) -> bool {
    matches!(platform.trim(), "codex" | "claude" | "grok" | "gemini")
}

/// Codex is the only agent that exposes a reasoning-effort knob AI Switch can
/// set at launch time (`-c model_reasoning_effort=<level>`).
pub fn agent_supports_reasoning(platform: &str) -> bool {
    platform.trim() == "codex"
}

/// Resolves `program` against `PATH`, honoring `PATHEXT` on Windows where the
/// agent CLIs are shims (`codex.cmd`, `codex.ps1`) rather than bare executables.
pub fn find_program_in_path(program: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let dirs = std::env::split_paths(&path).collect::<Vec<_>>();
    let pathext = std::env::var("PATHEXT").unwrap_or_default();
    find_program_in_dirs(&dirs, program, &pathext)
}

pub fn find_program_in_dirs(dirs: &[PathBuf], program: &str, pathext: &str) -> Option<PathBuf> {
    let program = program.trim();
    if program.is_empty() {
        return None;
    }

    let extensions = executable_extensions(pathext);
    for dir in dirs {
        if dir.as_os_str().is_empty() {
            continue;
        }
        let base = dir.join(program);
        if base.is_file() {
            return Some(base);
        }
        for extension in &extensions {
            let candidate = dir.join(format!("{program}{extension}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

pub(crate) fn executable_extensions(pathext: &str) -> Vec<String> {
    pathext
        .split(';')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            if value.starts_with('.') {
                value.to_string()
            } else {
                format!(".{value}")
            }
        })
        .collect()
}
