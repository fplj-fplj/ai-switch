import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeepAliveSettings } from "../../src/components/settings/keep-alive-settings";
import { I18nProvider } from "../../src/lib/i18n";
import { getTransport } from "../../src/lib/transport";

vi.mock("../../src/lib/transport", () => ({
  getTransport: vi.fn(),
  isDesktop: vi.fn(() => false),
}));

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36";

function renderSettings() {
  return render(
    <I18nProvider initialLanguage="zh-CN">
      <KeepAliveSettings />
    </I18nProvider>,
  );
}

describe("KeepAliveSettings", () => {
  const call = vi.fn();

  beforeEach(() => {
    call.mockReset();
    vi.mocked(getTransport).mockReturnValue({ call } as never);
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: ANDROID_UA,
    });
  });

  it("offers the battery-optimisation request while the app is still optimised", async () => {
    call.mockImplementation(async (command: string) => {
      if (command.endsWith("getKeepAliveStatus")) {
        return {
          manufacturer: "Xiaomi",
          brand: "Redmi",
          ignoringBatteryOptimizations: false,
        };
      }
      return { opened: true };
    });

    renderSettings();

    expect(await screen.findByText("系统可能会在后台冻结本应用。")).toBeInTheDocument();
    // The vendor is named, because "open the keep-alive settings" means nothing
    // without saying whose.
    expect(screen.getByRole("button", { name: /打开 Xiaomi 的保活设置/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "忽略电池优化" }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("plugin:pool-runtime|requestIgnoreBatteryOptimizations"),
    );
  });

  it("drops the request once the system has already exempted the app", async () => {
    call.mockResolvedValue({
      manufacturer: "samsung",
      brand: "samsung",
      ignoringBatteryOptimizations: true,
    });

    renderSettings();

    expect(await screen.findByText("系统已允许本应用在后台运行。")).toBeInTheDocument();
    // Nothing left to ask for, so the button that would ask is gone — but the
    // vendor screen stays, because Samsung's actual blocker is its sleeping-apps
    // list and that is only reachable there.
    expect(screen.queryByRole("button", { name: "忽略电池优化" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /打开 samsung 的保活设置/ })).toBeInTheDocument();
  });

  it("renders nothing at all off the mobile build", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
    });

    renderSettings();

    expect(screen.queryByText(/后台保活|冻结本应用/)).not.toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });
});
