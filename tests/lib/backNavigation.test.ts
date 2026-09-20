import { beforeEach, describe, expect, it, vi } from "vitest";

const { close } = vi.hoisted(() => ({ close: vi.fn() }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close }),
}));

vi.mock("../../src/lib/platform", () => ({
  isAndroidApp: vi.fn(),
}));

import { isAndroidApp } from "../../src/lib/platform";
import { requestAppExit, resolveBackAction } from "../../src/lib/backNavigation";

const base = { handlerConsumed: false, drawerVisible: false, settingsActive: false };

describe("resolveBackAction", () => {
  it("lets a dialog win over everything behind it", () => {
    expect(
      resolveBackAction({
        handlerConsumed: true,
        drawerVisible: true,
        settingsActive: true,
      }),
    ).toBe("dialog");
  });

  it("closes the drawer before falling back to Settings", () => {
    expect(resolveBackAction({ ...base, drawerVisible: true })).toBe("drawer");
  });

  it("falls back to Settings from any other screen", () => {
    expect(resolveBackAction(base)).toBe("settings");
  });

  it("asks to exit at the Settings root instead of swallowing the press", () => {
    expect(resolveBackAction({ ...base, settingsActive: true })).toBe("exit");
  });
});

describe("requestAppExit", () => {
  beforeEach(() => {
    close.mockReset();
    vi.mocked(isAndroidApp).mockReset();
  });

  it("closes the window on Android", async () => {
    vi.mocked(isAndroidApp).mockReturnValue(true);
    close.mockResolvedValue(undefined);

    await requestAppExit();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does nothing off Android", async () => {
    vi.mocked(isAndroidApp).mockReturnValue(false);

    await requestAppExit();

    expect(close).not.toHaveBeenCalled();
  });

  it("swallows a rejected close so the press stays silent", async () => {
    vi.mocked(isAndroidApp).mockReturnValue(true);
    close.mockRejectedValue(new Error("not allowed"));

    await expect(requestAppExit()).resolves.toBeUndefined();
  });
});
