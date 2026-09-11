use std::sync::Arc;

use tauri::State;
#[cfg(feature = "desktop")]
use tauri_plugin_opener::OpenerExt;

use crate::app_state::AppState;
use crate::error::ApiError;
use crate::services::route_proxy_service::{RouteProxyService, RouteProxyStatus};
use crate::services::tailscale_service::{TailscaleLogin, TailscaleStatus};
use crate::services::web_service::{WebServerStatus, WebService, WebServiceConfig};

#[tauri::command]
pub async fn get_web_service_config(
    state: State<'_, AppState>,
) -> Result<WebServiceConfig, ApiError> {
    WebService::load_config(&state.paths)
        .await
        .map_err(ApiError::from)
}

#[tauri::command]
pub async fn save_web_service_config(
    state: State<'_, AppState>,
    config: WebServiceConfig,
) -> Result<WebServiceConfig, ApiError> {
    let saved = WebService::save_config_and_reconcile(&state, &config)
        .await
        .map_err(ApiError::from)?;

    Ok(saved)
}

#[tauri::command]
pub async fn get_web_server_status(
    state: State<'_, AppState>,
) -> Result<WebServerStatus, ApiError> {
    let config = WebService::load_config(&state.paths)
        .await
        .map_err(ApiError::from)?;
    Ok(WebService::status(&state.web_service, &config).await)
}

#[tauri::command]
pub async fn start_web_server(state: State<'_, AppState>) -> Result<WebServerStatus, ApiError> {
    let app_state = Arc::new(state.inner().clone());
    WebService::start(app_state).await.map_err(ApiError::from)
}

#[tauri::command]
pub async fn stop_web_server(state: State<'_, AppState>) -> Result<WebServerStatus, ApiError> {
    Ok(WebService::stop(state.inner()).await)
}

#[tauri::command]
pub async fn set_route_access(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<RouteProxyStatus, ApiError> {
    WebService::set_route_access(state.inner(), enabled).await?;
    Ok(RouteProxyService::status(&state.route_proxy).await)
}

#[tauri::command]
pub async fn get_tailscale_status(state: State<'_, AppState>) -> Result<TailscaleStatus, ApiError> {
    WebService::tailscale_status(state.inner())
        .await
        .map_err(ApiError::from)
}

#[tauri::command]
pub async fn create_mobile_pairing(
    state: State<'_, AppState>,
    force: Option<bool>,
) -> Result<crate::services::mobile_pairing::MobilePairingPayload, ApiError> {
    WebService::create_mobile_pairing(state.inner(), force.unwrap_or(false))
        .await
        .map_err(ApiError::from)
}

#[tauri::command]
pub async fn start_tailscale_login(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<TailscaleLogin, ApiError> {
    // `mut` is only needed where the opener below can rewrite `login.message` on
    // failure, which is desktop-only; on Android nothing reassigns it.
    #[cfg_attr(not(feature = "desktop"), allow(unused_mut))]
    let mut login = WebService::start_tailscale_login(state.inner())
        .await
        .map_err(ApiError::from)?;

    if let Some(login_url) = login
        .login_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        // `tauri-plugin-opener` is a desktop dependency. On Android the sign-in
        // URL still comes back in `login.login_url` for the UI to open itself, so
        // the flow degrades to "tap the link" rather than failing.
        #[cfg(feature = "desktop")]
        if let Err(error) = app.opener().open_url(login_url, None::<&str>) {
            login.message = format!("Sign-in page ready, but browser open failed: {error}");
        }
        #[cfg(not(feature = "desktop"))]
        let _ = (&app, login_url);
    }

    Ok(login)
}

#[tauri::command]
pub async fn start_tailscale_with_auth_key(
    state: State<'_, AppState>,
    auth_key: String,
) -> Result<TailscaleStatus, ApiError> {
    WebService::start_tailscale_with_auth_key(state.inner(), auth_key)
        .await
        .map_err(ApiError::from)
}

#[tauri::command]
pub async fn disconnect_tailscale(state: State<'_, AppState>) -> Result<TailscaleStatus, ApiError> {
    WebService::disconnect_tailscale(state.inner())
        .await
        .map_err(ApiError::from)
}
