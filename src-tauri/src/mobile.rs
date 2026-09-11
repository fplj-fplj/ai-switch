//! Android entry point.
//!
//! Included into `lib.rs` under the `mobile` feature, exactly like `desktop.rs`.
//! Tauri's Android runtime reaches it through `#[tauri::mobile_entry_point]`.
//!
//! It is the desktop `run()` minus everything a phone has no equivalent for —
//! tray, autostart, deep links, single instance, the updater and PTY-backed
//! terminals — and it differs in one structural way: the desktop app resolves
//! its data directory before the builder exists, while Android can only ask the
//! app for `app_data_dir()` from inside `setup`.

use app_state::AppState;
use commands::batch_commands::{
    create_batch, create_official_account, create_provider, get_official_account, list_batch_groups,
    update_official_account,
};
use commands::disk_space_commands::get_disk_space_status;
use commands::external_client_import_commands::{
    import_external_client_accounts, preview_external_client_import,
};
use commands::import_commands::import_example_json;
use commands::notification_commands::test_notification;
use commands::platform_commands::list_platform_capabilities;
use commands::route_credential_commands::{
    archive_route_credentials, clear_route_credential_failure_state,
    clear_route_credential_model_state, copy_route_credential, create_api_route_credential,
    delete_route_credential, get_route_credential, import_official_route_credentials_from_files,
    import_official_route_credentials_from_text, list_route_credentials,
    list_route_credentials_page, refresh_route_credential_quota,
    refresh_route_credential_relay_balance, refresh_route_credentials_quota,
    refresh_route_credentials_relay_balance, reorder_route_credentials,
    restore_route_credentials, set_route_credential_cooldown, set_route_credential_model_status,
    set_route_credential_recovery, set_route_credential_statuses, update_route_credential,
};
use commands::route_pool_commands::{
    create_route_pool_group, delete_route_pool_group, fetch_route_models, get_route_pool,
    move_route_pool_group_members, route_pool_route_once, route_pool_test_model,
    set_route_pool_group_members, set_route_pool_members, set_route_pool_model_mode,
    subscribe_route_proxy_live_log, unsubscribe_route_proxy_live_log, update_route_pool_group,
};
use commands::route_proxy_commands::{
    get_route_proxy_key, get_route_proxy_status, route_config_write_is_stale, start_route_proxy,
    stop_route_proxy, write_route_proxy_configs,
};
use commands::session_commands::{get_session_messages, list_sessions, open_session_terminal};
use commands::settings_commands::{get_settings, save_settings};
use commands::target_commands::{
    list_config_snapshots, list_config_write_clients, list_target_apps, list_target_config_statuses,
    rollback_config_snapshot,
};
use commands::usage_stats_commands::{
    get_model_price_configs, get_session_usage_stats, get_usage_overview,
    reload_model_price_overrides, save_model_price_configs,
};
use commands::web_service_commands::{
    create_mobile_pairing, disconnect_tailscale, get_tailscale_status, get_web_server_status,
    get_web_service_config, save_web_service_config, set_route_access, start_tailscale_login,
    start_tailscale_with_auth_key, start_web_server, stop_web_server,
};
use database::open_migrated_pool;
use paths::AppPaths;
use services::config_write_service::ConfigWriteRuntimeState;
use services::deeplink_protocol_service::DeepLinkProtocolRuntime;
use services::route_proxy_service::RouteProxyRuntimeState;
use services::route_recovery_service::RouteRecoveryService;
use services::tailscale_service::{TailscaleRuntimeState, TailscaleService};
use services::web_service::{WebService, WebServiceRuntimeState};
use std::sync::Arc;
use tauri::{Manager, RunEvent};
use web::event_bridge::{EventEmitter, WebEventBroadcaster};

/// Builds the state Android has no way to build before `setup` runs.
///
/// `AppPaths::resolve()` is unusable here: it walks `BaseDirs` down to `$HOME`,
/// and an Android app process has no meaningful `HOME`. Tauri's per-app data
/// directory is the sandbox-correct equivalent, so the paths are injected with
/// `AppPaths::from_data_dir` instead.
async fn bootstrap(app: tauri::AppHandle) -> Result<AppState, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Android app data directory is unavailable: {error}"))?;
    let paths = AppPaths::from_data_dir(base.join("ai-switch"));

    paths.ensure().await.map_err(|error| error.to_string())?;
    let pool = open_migrated_pool(&paths.database_file, &paths.backups_dir)
        .await
        .map_err(|error| error.to_string())?;

    let state = AppState {
        paths,
        pool,
        config_writes: ConfigWriteRuntimeState::default(),
        deeplink_protocols: DeepLinkProtocolRuntime::default(),
        // No tray on Android, so the "close goes to tray" question never comes up;
        // the default keeps the field meaningful rather than pretending otherwise.
        close_to_tray: crate::app_state::CloseToTrayRuntime::default(),
        route_proxy: RouteProxyRuntimeState::default(),
        saas: crate::saas::SaasRuntime::default(),
        web_service: WebServiceRuntimeState::default(),
        tailscale: TailscaleRuntimeState::default(),
        event_broadcaster: Arc::new(WebEventBroadcaster::new()),
    };

    // The panel is a WebView inside this process, so it listens for the same
    // Tauri events the desktop window does — not the WebSocket broadcaster, which
    // only exists for consumers outside the app.
    state
        .route_proxy
        .activity()
        .set_emitter(EventEmitter::Tauri(app.clone()));
    state
        .route_proxy
        .live_log()
        .set_emitter(EventEmitter::Tauri(app.clone()));

    // Auto-recovery scheduler: periodically re-enable accounts per their
    // configured recovery rule, same as desktop.
    let recovery_state = state.clone();
    tauri::async_runtime::spawn(async move {
        RouteRecoveryService::run_loop(
            recovery_state.pool.clone(),
            recovery_state.route_proxy.activity(),
        )
        .await;
    });

    Ok(state)
}

/// `mobile` here is the cfg that `tauri-build` sets for Android targets, not the
/// cargo feature of the same name; the attribute is what turns this into the
/// symbol the generated Android project calls into.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = tauri::async_runtime::block_on(bootstrap(app.handle().clone()))
                .map_err(|error| Box::new(std::io::Error::other(error)) as Box<dyn std::error::Error>)?;
            app.manage(state.clone());

            // Bind the compute pool on 127.0.0.1:19527. In a release build
            // `WebServiceConfig::default()` resolves to that port; `set_route_access`
            // is the same entry point the desktop "start" button uses, so the pool
            // comes up through one code path on both platforms.
            tauri::async_runtime::spawn(async move {
                if let Err(error) = WebService::set_route_access(&state, true).await {
                    eprintln!("Compute pool listener failed to start: {error}");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            create_batch,
            list_batch_groups,
            create_provider,
            create_official_account,
            get_official_account,
            update_official_account,
            list_platform_capabilities,
            get_disk_space_status,
            list_route_credentials,
            list_route_credentials_page,
            reorder_route_credentials,
            get_route_credential,
            create_api_route_credential,
            copy_route_credential,
            set_route_credential_recovery,
            set_route_credential_model_status,
            clear_route_credential_model_state,
            set_route_credential_cooldown,
            clear_route_credential_failure_state,
            import_official_route_credentials_from_text,
            import_official_route_credentials_from_files,
            update_route_credential,
            delete_route_credential,
            archive_route_credentials,
            restore_route_credentials,
            set_route_credential_statuses,
            refresh_route_credential_quota,
            refresh_route_credentials_quota,
            refresh_route_credential_relay_balance,
            refresh_route_credentials_relay_balance,
            preview_external_client_import,
            import_external_client_accounts,
            import_example_json,
            get_route_pool,
            create_route_pool_group,
            update_route_pool_group,
            delete_route_pool_group,
            set_route_pool_group_members,
            move_route_pool_group_members,
            set_route_pool_members,
            set_route_pool_model_mode,
            route_pool_route_once,
            route_pool_test_model,
            fetch_route_models,
            subscribe_route_proxy_live_log,
            unsubscribe_route_proxy_live_log,
            start_route_proxy,
            stop_route_proxy,
            get_route_proxy_status,
            get_route_proxy_key,
            write_route_proxy_configs,
            route_config_write_is_stale,
            list_sessions,
            get_session_messages,
            open_session_terminal,
            get_model_price_configs,
            save_model_price_configs,
            get_session_usage_stats,
            get_usage_overview,
            reload_model_price_overrides,
            list_target_apps,
            list_target_config_statuses,
            list_config_write_clients,
            list_config_snapshots,
            rollback_config_snapshot,
            get_web_service_config,
            save_web_service_config,
            get_web_server_status,
            start_web_server,
            stop_web_server,
            set_route_access,
            get_tailscale_status,
            create_mobile_pairing,
            start_tailscale_login,
            start_tailscale_with_auth_key,
            disconnect_tailscale,
            test_notification
        ])
        .build(tauri::generate_context!())
        .expect("failed to build AI Switch")
        .run(|app_handle, event| {
            // Android tears the process down without dropping Tauri-managed state,
            // so this is the only place the tailscale sidecar and the SaaS log
            // queue get a chance to stop cleanly.
            if let RunEvent::Exit = event {
                let state = app_handle.state::<AppState>();
                tauri::async_runtime::block_on(async {
                    if state.saas.logs.shutdown().await.is_err() {
                        eprintln!("SaaS log queue could not drain before exit");
                    }
                });
                tauri::async_runtime::block_on(TailscaleService::shutdown(&state.tailscale));
            }
        });
}
