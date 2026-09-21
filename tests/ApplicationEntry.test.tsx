import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { isMobileApp } = vi.hoisted(() => ({ isMobileApp: vi.fn() }));

vi.mock("../src/App", () => ({ App: () => <div>administrator</div> }));
vi.mock("../src/mobile/MobileApp", () => ({ MobileApp: () => <div>mobile-shell</div> }));
vi.mock("../src/lib/platform", () => ({ isMobileApp }));

import { ApplicationEntry } from "../src/ApplicationEntry";

afterEach(() => {
  cleanup();
  isMobileApp.mockReset();
});

describe("ApplicationEntry", () => {
  it("renders the administrator app when not on mobile", () => {
    isMobileApp.mockReturnValue(false);
    render(<ApplicationEntry />);
    expect(screen.getByText("administrator")).toBeInTheDocument();
    expect(screen.queryByText("mobile-shell")).not.toBeInTheDocument();
  });

  // The whole point of the split: the phone must not get the desktop tree, which is
  // exactly what `isDesktop()` would have handed it (it is true inside the Android
  // WebView, since it answers "am I in Tauri" rather than "is this the desktop app").
  it("renders the mobile shell on a mobile app", () => {
    isMobileApp.mockReturnValue(true);
    render(<ApplicationEntry />);
    expect(screen.getByText("mobile-shell")).toBeInTheDocument();
    expect(screen.queryByText("administrator")).not.toBeInTheDocument();
  });
});
