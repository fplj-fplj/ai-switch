import React from "react";
import ReactDOM from "react-dom/client";
import { ApplicationEntry } from "./ApplicationEntry";
import { installCrashCapture, installSessionHeartbeat, importNativeReports } from "./lib/crashLog";
import { getRenderProcessSilences } from "./lib/poolRuntime";
import "virtual:uno.css";
import "./styles.css";
// The mobile tree's semantic tokens. Loaded unconditionally because a stylesheet of
// custom-property definitions costs nothing until something reads one, and only the
// mobile tree does (`src/mobile/**`). The names are a separate space from the ones
// `styles.css` defines, so this cannot shadow a desktop token — `tests/designTokens`
// pins the other half of that, that adding these keeps the desktop palette intact.
import "./styles/tokens.css";

// Before React, so a failure during the first render is recorded too — that is the
// one most likely to leave nothing but a blank window.
installCrashCapture();
// The other half: whether the page was still running the last time it was seen, which
// is what separates "it failed" from "it was taken away".
installSessionHeartbeat();
// And the same question asked from outside the page, by the Android watchdog — the
// only one of the two that can notice a renderer stop answering at the moment it does.
importNativeReports(getRenderProcessSilences);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApplicationEntry />
  </React.StrictMode>,
);
