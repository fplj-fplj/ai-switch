import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleStop, RefreshCcw, Server, ShieldCheck } from "lucide-react";
import {
  getWebServerStatus,
  getWebServiceConfig,
  saveWebServiceConfig,
  setRouteAccess,
  startWebServer,
  stopWebServer,
} from "../../lib/api/client";
import type { WebServiceConfig } from "../../lib/api/types";
import { useI18n } from "../../lib/i18n";
import { isDesktopApp, isMobileApp } from "../../lib/platform";
import { TokenInput } from "../auth/TokenInput";
import { TailscaleSettings } from "./tailscale-settings";

const defaultConfig: WebServiceConfig = {
  host: "127.0.0.1",
  port: process.env.NODE_ENV !== "production" ? 10086 : 19527,
  token: "",
  routeAccessEnabled: false,
  tailscaleEnabled: false,
  tailscaleExposureMode: "private",
  tlsEnabled: false,
  tlsCertPath: null,
  tlsKeyPath: null,
  allowLanAccess: false,
};

const MINIMUM_WEB_TOKEN_LENGTH = 16;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return LOOPBACK_HOSTS.has(normalized);
}

function normalizeConfig(config: WebServiceConfig): WebServiceConfig {
  return {
    host: config.host.trim() || defaultConfig.host,
    port: Number.isFinite(config.port) && config.port > 0 ? config.port : defaultConfig.port,
    token: config.token?.trim() || "",
    routeAccessEnabled: Boolean(config.routeAccessEnabled),
    tailscaleEnabled: Boolean(config.tailscaleEnabled),
    tailscaleHostname: config.tailscaleHostname?.trim() || null,
    tailscaleAuthKeyPresent: Boolean(config.tailscaleAuthKeyPresent),
    tailscaleExposureMode: config.tailscaleExposureMode === "public" ? "public" : "private",
    tlsEnabled: Boolean(config.tlsEnabled),
    tlsCertPath: config.tlsCertPath?.trim() || null,
    tlsKeyPath: config.tlsKeyPath?.trim() || null,
    allowLanAccess: Boolean(config.allowLanAccess),
  };
}

export function WebServiceSettings() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  // The listener is environment-managed only in the standalone server and the
  // browser build, where a process or a proxy decides the address. The desktop app
  // and the mobile app both own theirs — the phone runs the same shared listener
  // on 19527, and the LAN switch below lives in this panel — so both get the
  // editable form. Gating on `isDesktopApp()` alone left the panel showing nothing
  // but a hint on Android.
  const ownsListener = isDesktopApp() || isMobileApp();
  // Tailscale is the one thing here that really is desktop-only: its sidecar is a
  // Go binary that is not shipped in the APK.
  const desktop = isDesktopApp();
  // Set while the LAN switch is being confirmed: flipping it on asks first, so the
  // checkbox reads from the config and this only gates the warning block.
  const [lanAccessPending, setLanAccessPending] = useState(false);
  const configQuery = useQuery({
    queryKey: ["web-service-config"],
    queryFn: getWebServiceConfig,
  });
  const statusQuery = useQuery({
    queryKey: ["web-server-status"],
    queryFn: getWebServerStatus,
  });
  const [form, setForm] = useState<WebServiceConfig>(defaultConfig);

  useEffect(() => {
    if (configQuery.data) {
      setForm(normalizeConfig(configQuery.data));
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saved = await saveWebServiceConfig(normalizeConfig(form));
      queryClient.setQueryData(["web-service-config"], saved);
      await queryClient.invalidateQueries({ queryKey: ["tailscale-status"] });
      return saved;
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeConfig(form);
      if ((normalized.token?.length ?? 0) < MINIMUM_WEB_TOKEN_LENGTH) {
        throw new Error(t("settings.webService.tokenTooShort"));
      }
      const saved = await saveWebServiceConfig(normalized);
      queryClient.setQueryData(["web-service-config"], saved);
      const status = await startWebServer();
      queryClient.setQueryData(["web-server-status"], status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tailscale-status"] }),
        queryClient.invalidateQueries({ queryKey: ["route-proxy-status"] }),
        queryClient.invalidateQueries({ queryKey: ["route-proxy-https-status"] }),
      ]);
      return status;
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const status = await stopWebServer();
      queryClient.setQueryData(["web-server-status"], status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tailscale-status"] }),
        queryClient.invalidateQueries({ queryKey: ["route-proxy-status"] }),
        queryClient.invalidateQueries({ queryKey: ["route-proxy-https-status"] }),
      ]);
      return status;
    },
  });

  const routeAccessMutation = useMutation({
    mutationFn: (enabled: boolean) => setRouteAccess(enabled),
    onSuccess: (status) => {
      setForm((current) => ({
        ...current,
        routeAccessEnabled: Boolean(status.route_access_enabled),
      }));
      queryClient.setQueryData(["route-proxy-status"], status);
      void queryClient.invalidateQueries({ queryKey: ["web-server-status"] });
    },
    onError: () => {
      void configQuery.refetch();
    },
  });

  const status = statusQuery.data;
  const httpTransportRequiresTls = !form.tlsEnabled && !isLoopbackHost(form.host);
  const serviceHost = status?.host ?? form.host;
  const servicePort = status?.port ?? form.port;

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white/82 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-stone-950 text-white">
                <Server className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-stone-950">
                  {t("settings.webService.listenerTitle")}
                </h2>
                <p className="text-[12px] text-stone-500">
                  {t("settings.webService.listenerSubtitle")}
                </p>
              </div>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] font-semibold text-stone-700 motion-control hover:border-stone-300 hover:bg-white"
            onClick={() => {
              void configQuery.refetch();
              void statusQuery.refetch();
              void queryClient.invalidateQueries({ queryKey: ["route-proxy-status"] });
              void queryClient.invalidateQueries({ queryKey: ["route-proxy-https-status"] });
            }}
            type="button"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {t("settings.webService.refresh")}
          </button>
        </div>

        {configQuery.isLoading ? (
          <p className="text-[12px] text-stone-500">{t("settings.webService.loading")}</p>
        ) : (
          <>
            {ownsListener ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[12px] font-medium text-stone-600">
                    <span>{t("settings.webService.host")}</span>
                    <input
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-900 outline-none motion-control focus:border-stone-400 focus:ring-2 focus:ring-stone-100"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, host: event.target.value }))
                      }
                      value={form.host}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[12px] font-medium text-stone-600">
                    <span>{t("settings.webService.port")}</span>
                    <input
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-900 outline-none motion-control focus:border-stone-400 focus:ring-2 focus:ring-stone-100"
                      min={1}
                      max={65535}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, port: Number(event.target.value) }))
                      }
                      type="number"
                      value={form.port}
                    />
                  </label>
                </div>
                {/* The switch owns the pair: it sets the permission and the host
                    together, so the two can never disagree. Turning it on asks
                    first — it is the one control here that reaches past this
                    device. */}
                <label className="flex max-w-xl items-start gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-stone-700">
                  <input
                    aria-label={t("settings.webService.lanAccess")}
                    checked={form.allowLanAccess === true}
                    className="mt-0.5"
                    onChange={(event) => {
                      if (event.target.checked) {
                        setLanAccessPending(true);
                        return;
                      }
                      setLanAccessPending(false);
                      setForm((current) => ({
                        ...current,
                        allowLanAccess: false,
                        host: "127.0.0.1",
                      }));
                    }}
                    type="checkbox"
                  />
                  <span className="grid gap-1">
                    <span>{t("settings.webService.lanAccess")}</span>
                    <span className="text-[11px] font-medium text-stone-500">
                      {t("settings.webService.lanAccessHint")}
                    </span>
                  </span>
                </label>
                {lanAccessPending && form.allowLanAccess !== true ? (
                  <div className="grid max-w-xl gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
                    <p className="text-[12px] font-medium leading-5 text-amber-900">
                      {t("settings.webService.lanAccessWarning")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg bg-amber-700 px-3 py-1.5 text-[12px] font-semibold text-white motion-control hover:bg-amber-800"
                        onClick={() => {
                          setLanAccessPending(false);
                          setForm((current) => ({
                            ...current,
                            allowLanAccess: true,
                            host: "0.0.0.0",
                          }));
                        }}
                        type="button"
                      >
                        {t("settings.webService.lanAccessConfirm")}
                      </button>
                      <button
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-900 motion-control hover:bg-amber-100"
                        onClick={() => setLanAccessPending(false)}
                        type="button"
                      >
                        {t("settings.webService.lanAccessCancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
                {form.allowLanAccess === true ? (
                  <p className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    {t("settings.webService.lanAccessOn")}
                  </p>
                ) : null}
                {httpTransportRequiresTls ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    {t("settings.webService.hostTransportHint")}
                  </p>
                ) : null}
                <TokenInput
                  label={t("settings.webService.token")}
                  onChange={(value) => setForm((current) => ({ ...current, token: value }))}
                  value={form.token ?? ""}
                  copy
                />
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] font-medium text-stone-700">
                    <input
                      checked={form.tailscaleEnabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          tailscaleEnabled: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    {t("settings.webService.tailscaleEnabled")}
                  </label>
                  {form.tailscaleEnabled ? (
                    <label className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] font-medium text-stone-700">
                      <span>{t("settings.webService.exposureMode")}</span>
                      <select
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12px] font-semibold text-stone-800 outline-none focus:border-stone-400"
                        onChange={(event) => {
                          const nextMode = event.target.value === "public" ? "public" : "private";
                          if (nextMode === "public") {
                            const ok = window.confirm(t("settings.webService.publicConfirm"));
                            if (!ok) {
                              return;
                            }
                          }
                          setForm((current) => ({
                            ...current,
                            tailscaleExposureMode: nextMode,
                          }));
                        }}
                        value={form.tailscaleExposureMode ?? "private"}
                      >
                        <option value="private">
                          {t("settings.webService.exposurePrivate")}
                        </option>
                        <option value="public">{t("settings.webService.exposurePublic")}</option>
                      </select>
                    </label>
                  ) : null}
                </div>
                {form.tailscaleEnabled && form.tailscaleExposureMode === "public" ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    {t("settings.webService.publicHint")}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-600">
                <p className="font-semibold text-stone-700">
                  {t("settings.webService.standaloneManaged")}
                </p>
                <p>
                  {serviceHost}:{servicePort}
                </p>
              </div>
            )}

            <p className="text-[12px] text-stone-500">{t("settings.webService.sharedHint")}</p>

            {ownsListener ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-xl bg-stone-900 px-3 py-2 text-[13px] font-semibold text-white motion-control hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  type="button"
                >
                  {t("settings.webService.save")}
                </button>
                {status?.running ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-700 motion-control hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={stopMutation.isPending}
                    onClick={() => stopMutation.mutate()}
                    type="button"
                  >
                    <CircleStop className="h-3.5 w-3.5" />
                    {t("settings.webService.stop")}
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-700 motion-control hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={startMutation.isPending}
                    onClick={() => startMutation.mutate()}
                    type="button"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("settings.webService.start")}
                  </button>
                )}
              </div>
            ) : null}

            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-600">
              {status?.running && status.baseUrl ? (
                <p>{t("settings.webService.running", { url: status.baseUrl })}</p>
              ) : (
                <p>{t("settings.webService.stopped")}</p>
              )}
              {saveMutation.isError ? (
                <p className="mt-1 text-red-700">{t("settings.webService.saveError")}</p>
              ) : null}
              {startMutation.isError ? (
                <p className="mt-1 text-red-700">
                  {startMutation.error instanceof Error && startMutation.error.message
                    ? startMutation.error.message
                    : t("settings.webService.startError")}
                </p>
              ) : null}
              {stopMutation.isError ? (
                <p className="mt-1 text-red-700">{t("settings.webService.stopError")}</p>
              ) : null}
              {saveMutation.isSuccess ? (
                <p className="mt-1 text-emerald-700">{t("settings.webService.saved")}</p>
              ) : null}
            </div>

            {desktop ? (
              <TailscaleSettings
                enabled={form.tailscaleEnabled}
                exposureMode={form.tailscaleExposureMode ?? "private"}
              />
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white/82 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-stone-950 text-white">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-stone-950">
              {t("settings.webService.routeTitle")}
            </h2>
            <p className="text-[12px] text-stone-500">
              {t("settings.webService.routeSubtitle")}
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] font-medium text-stone-700">
          <input
            checked={form.routeAccessEnabled}
            disabled={routeAccessMutation.isPending}
            onChange={(event) => routeAccessMutation.mutate(event.target.checked)}
            type="checkbox"
          />
          {t("settings.webService.routeEnabled")}
        </label>
        <p className="text-[12px] text-stone-500">{t("settings.webService.routeHint")}</p>
        {routeAccessMutation.isError ? (
          <p className="text-[12px] text-red-700">{t("settings.webService.routeError")}</p>
        ) : null}
      </section>
    </>
  );
}
