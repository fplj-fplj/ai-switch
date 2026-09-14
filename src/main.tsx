import React from "react";
import ReactDOM from "react-dom/client";
import { ApplicationEntry } from "./ApplicationEntry";
import { installCrashCapture } from "./lib/crashLog";
import "virtual:uno.css";
import "./styles.css";

// Before React, so a failure during the first render is recorded too — that is the
// one most likely to leave nothing but a blank window.
installCrashCapture();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApplicationEntry />
  </React.StrictMode>,
);
