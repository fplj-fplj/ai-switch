import { ChevronDown, Copy, TriangleAlert, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { copyPlainText } from "../../lib/copyToClipboard";
import {
  clearCrashes,
  readCrashes,
  readTrail,
  subscribeToCrashLog,
  type CrashEntry,
  type TrailEntry,
} from "../../lib/crashLog";

/** How many of the recorded interactions are shown. Enough for a gesture, not a log. */
const TRAIL_SHOWN = 12;

/**
 * Reports what went wrong on an earlier launch, and stays until it is dismissed.
 *
 * The panel an error boundary draws is only there while the app is up; a white
 * screen is precisely the case where it is not. This is the other half of that —
 * what the device could not show at the time is shown on the next launch, with the
 * interactions that led up to it, and copyable so it can be handed on whole.
 *
 * A list with nothing in it renders nothing, so this costs an ordinary launch a
 * pair of reads and no layout.
 */
export function CrashReportBanner() {
  const crashes = useSyncExternalStore(subscribeToCrashLog, readCrashes);
  const trail = useSyncExternalStore(subscribeToCrashLog, readTrail);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (crashes.length === 0) {
    return null;
  }

  const newest = crashes[0];
  const leadingTrail = trailLeadingTo(trail, newest);

  const report = formatReport(crashes, trail);

  return (
    <div
      aria-live="assertive"
      className="fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-[75] w-[min(calc(100vw-1.5rem),34rem)] -translate-x-1/2"
      role="alert"
    >
      <div className="rounded-2xl bg-amber-50 px-4 py-3 shadow-lg ring-1 ring-amber-300">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <TriangleAlert aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-amber-900">
              上次运行记录了 {crashes.length} 个错误
            </p>
            <p className="mt-0.5 break-all font-mono text-[11px] leading-5 text-amber-800">
              {newest.source} · {newest.at}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] leading-5 text-amber-900">
              {newest.message}
            </p>

            {expanded ? (
              <div className="mt-2 grid max-h-[50vh] gap-2 overflow-auto rounded-lg border border-amber-200 bg-white/70 p-2">
                {newest.stack ? (
                  <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-stone-700">
                    {newest.stack}
                  </pre>
                ) : null}
                <div>
                  <p className="text-[11px] font-semibold text-stone-600">出错之前的操作</p>
                  {leadingTrail.length === 0 ? (
                    <p className="mt-0.5 text-[11px] text-stone-500">（没有记录到操作）</p>
                  ) : (
                    <ol className="mt-0.5 grid gap-0.5">
                      {leadingTrail.map((entry, index) => (
                        <li
                          className="break-all font-mono text-[10px] leading-relaxed text-stone-600"
                          key={`${entry.at}-${index}`}
                        >
                          {entry.at.slice(11, 19)} · {entry.label}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {crashes.length > 1 ? (
                  <div>
                    <p className="text-[11px] font-semibold text-stone-600">
                      其余 {crashes.length - 1} 条
                    </p>
                    <ol className="mt-0.5 grid gap-0.5">
                      {crashes.slice(1).map((entry, index) => (
                        <li
                          className="break-all font-mono text-[10px] leading-relaxed text-stone-600"
                          key={`${entry.at}-${index}`}
                        >
                          {entry.at.slice(11, 19)} · {entry.source} · {entry.message}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-amber-900 motion-control hover:bg-amber-100"
                onClick={() => setExpanded((value) => !value)}
                type="button"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 motion-control ${expanded ? "rotate-180" : ""}`}
                />
                {expanded ? "收起" : "详情"}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-amber-900 motion-control hover:bg-amber-100"
                onClick={() => {
                  // Copying the whole thing is the point: a phone screenshot of a
                  // stack is unreadable, and this is meant to be handed on.
                  void copyPlainText(report).then((ok) => setCopied(ok));
                }}
                type="button"
              >
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          </div>
          <button
            aria-label="清除崩溃记录"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-800"
            onClick={() => {
              setExpanded(false);
              setCopied(false);
              clearCrashes();
            }}
            title="清除"
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The interactions that led to the newest crash, oldest first.
 *
 * Cut by the count the crash recorded rather than by timestamp: anything after it
 * belongs to the recovery — the taps that got the app back — and pairing those with
 * the failure would read as a cause.
 */
function trailLeadingTo(trail: TrailEntry[], newest: CrashEntry): TrailEntry[] {
  return trail.slice(0, newest.trailLength).slice(-TRAIL_SHOWN);
}

function formatReport(crashes: CrashEntry[], trail: TrailEntry[]): string {
  const lines = [
    `AI Switch 崩溃记录（${crashes.length} 条）`,
    `UA: ${typeof navigator === "undefined" ? "?" : navigator.userAgent}`,
    "",
  ];
  for (const crash of crashes) {
    lines.push(`[${crash.at}] ${crash.source}`, crash.message, crash.stack ?? "", "");
  }
  lines.push("--- 操作记录 ---");
  for (const entry of trail) {
    lines.push(`${entry.at} ${entry.label}`);
  }
  return lines.join("\n");
}
