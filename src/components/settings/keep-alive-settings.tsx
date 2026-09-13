import { BatteryCharging, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { isMobileApp } from "../../lib/platform";
import {
  getKeepAliveStatus,
  openVendorKeepAliveSettings,
  requestIgnoreBatteryOptimizations,
  type KeepAliveStatus,
} from "../../lib/poolRuntime";

/**
 * Whether this phone will let the pool keep answering once the app is in the
 * background, and the two things that can change that answer.
 *
 * Plain state rather than a query: the answer only changes while the user is off in
 * a system screen, so it is re-read when the app comes back to the foreground —
 * which is the one moment it can be stale — instead of being polled.
 *
 * The two steps are separate because they are separate problems. Battery
 * optimisation is stock Android and the request dialog is the whole fix; every
 * vendor's auto-start or sleep list is a different screen in a different package,
 * and the one that exists is found on the Android side.
 */
export function KeepAliveSettings() {
  const { t } = useI18n();
  const [status, setStatus] = useState<KeepAliveStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getKeepAliveStatus().then(setStatus);
  }, []);

  useEffect(() => {
    if (!isMobileApp()) {
      return;
    }
    refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  if (!isMobileApp() || !status) {
    return null;
  }

  const vendor = status.manufacturer.trim() || status.brand.trim();
  const exempt = status.ignoringBatteryOptimizations;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
        <span
          className={`mt-0.5 shrink-0 ${exempt ? "text-emerald-600" : "text-amber-600"}`}
        >
          {exempt ? (
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          ) : (
            <BatteryCharging aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
        <div className="grid gap-0.5">
          <p className="text-[12px] font-semibold text-stone-800">
            {exempt ? t("settings.keepAlive.exempt") : t("settings.keepAlive.optimized")}
          </p>
          <p className="text-[11px] font-medium leading-5 text-stone-500">
            {t("settings.keepAlive.hint", { vendor: vendor || t("settings.keepAlive.unknownVendor") })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!exempt ? (
          <button
            className="rounded-xl bg-stone-900 px-3 py-2 text-[13px] font-semibold text-white motion-control hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await requestIgnoreBatteryOptimizations();
                refresh();
              })
            }
            type="button"
          >
            {t("settings.keepAlive.request")}
          </button>
        ) : null}
        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-700 motion-control hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void run(() => openVendorKeepAliveSettings())}
          type="button"
        >
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          {t("settings.keepAlive.openVendor", { vendor: vendor || t("settings.keepAlive.unknownVendor") })}
        </button>
        <button
          aria-label={t("settings.keepAlive.recheck")}
          className="grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500 motion-control hover:border-stone-300 hover:text-stone-800"
          disabled={busy}
          onClick={() => refresh()}
          title={t("settings.keepAlive.recheck")}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
