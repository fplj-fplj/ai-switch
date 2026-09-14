import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CrashReportBanner } from "../../src/components/system/CrashReportBanner";
import { clearCrashes, recordAction, recordCrash } from "../../src/lib/crashLog";

describe("CrashReportBanner", () => {
  beforeEach(() => {
    clearCrashes();
  });

  it("renders nothing on an ordinary launch", () => {
    // It sits outside the app's error boundary on every screen, so an empty report
    // has to cost no layout at all.
    const { container } = render(<CrashReportBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the failure, and the interactions that led up to it", async () => {
    recordAction("打开算力池测试菜单");
    recordAction("推理程度 low 1");
    recordCrash("window.onerror", new Error("Cannot read properties of null"));
    // The tap that got the app back — after the failure, so not part of it.
    recordAction("重试");

    render(<CrashReportBanner />);

    expect(screen.getByText("上次运行记录了 1 个错误")).toBeInTheDocument();
    expect(screen.getByText(/Cannot read properties of null/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "详情" }));

    expect(screen.getByText(/推理程度 low 1/)).toBeInTheDocument();
    expect(screen.queryByText(/重试/)).not.toBeInTheDocument();
  });

  it("reports every error, not only the newest", async () => {
    recordCrash("window.onerror", new Error("first"));
    recordCrash("unhandledrejection", new Error("second"));

    render(<CrashReportBanner />);
    await userEvent.click(screen.getByRole("button", { name: "详情" }));

    // The newest is the headline; the rest are listed under it. The older one is
    // matched through its whole line because its stack also names it.
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getByText(/window\.onerror · first/)).toBeInTheDocument();
  });

  it("stays until it is dismissed, then stays gone", async () => {
    recordCrash("window.onerror", new Error("boom"));

    const { unmount } = render(<CrashReportBanner />);
    await userEvent.click(screen.getByLabelText("清除崩溃记录"));
    unmount();

    // A second mount reads storage again: dismissing has to clear the record, not
    // just hide this instance.
    const { container } = render(<CrashReportBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
