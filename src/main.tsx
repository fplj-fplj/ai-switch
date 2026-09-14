import React from "react";
import ReactDOM from "react-dom/client";
import { ApplicationEntry } from "./ApplicationEntry";
import { installCrashCapture, installSessionHeartbeat } from "./lib/crashLog";
import "virtual:uno.css";
import "./styles.css";

// Before React, so a failure during the first render is recorded too — that is the
// one most likely to leave nothing but a blank window.
installCrashCapture();
// The other half: whether the page was still running the last time it was seen, which
// is what separates "it failed" from "it was taken away".
installSessionHeartbeat();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApplicationEntry />
  </React.StrictMode>,
);
