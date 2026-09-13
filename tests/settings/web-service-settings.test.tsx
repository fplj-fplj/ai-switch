import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWebServiceConfig,
  getWebServerStatus,
  saveWebServiceConfig,
  setRouteAccess,
  startWebServer,
  stopWebServer,
} from "../../src/lib/api/client";
import { WebServiceSettings } from "../../src/components/settings/web-service-settings";
import { I18nProvider } from "../../src/lib/i18n";
import { isDesktop } from "../../src/lib/transport";
import { createQueryClient } from "../../src/lib/query/queryClient";

vi.mock("../../src/lib/api/client", () => ({
  getWebServiceConfig: vi.fn(),
  getWebServerStatus: vi.fn(),
  saveWebServiceConfig: vi.fn(),
  setRouteAccess: vi.fn(),
  startWebServer: vi.fn(),
  stopWebServer: vi.fn(),
}));
vi.mock("../../src/lib/transport", () => ({ isDesktop: vi.fn() }));
vi.mock("../../src/components/settings/tailscale-settings", () => ({
  TailscaleSettings: () => null,
}));

function renderSettings() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <I18nProvider initialLanguage="zh-CN">
        <WebServiceSettings />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("WebServiceSettings", () => {
  beforeEach(() => {
    vi.mocked(isDesktop).mockReset();
    vi.mocked(getWebServiceConfig).mockReset();
    vi.mocked(getWebServerStatus).mockReset();
    vi.mocked(saveWebServiceConfig).mockReset();
    vi.mocked(setRouteAccess).mockReset();
    vi.mocked(startWebServer).mockReset();
    vi.mocked(stopWebServer).mockReset();
    vi.mocked(isDesktop).mockReturnValue(true);
    vi.mocked(getWebServiceConfig).mockResolvedValue({
      host: "127.0.0.1",
      port: 19527,
      token: "0123456789abcdef",
      routeAccessEnabled: true,
      tailscaleEnabled: false,
      tailscaleExposureMode: "private",
      tlsEnabled: false,
      tlsCertPath: null,
      tlsKeyPath: null,
    });
    vi.mocked(getWebServerStatus).mockResolvedValue({
      running: true,
      host: "127.0.0.1",
      port: 19527,
      baseUrl: "http://127.0.0.1:19527",
    });
    vi.mocked(setRouteAccess).mockResolvedValue({
      running: true,
      route_access_enabled: false,
      shared_listener: true,
      bind_host: "127.0.0.1",
      port: 19527,
      base_url: "http://127.0.0.1:19527",
      https_port: null,
      https_base_url: null,
      https_error: null,
    });
  });

  it("separates the shared listener from route access and keeps both switches independent", async () => {
    renderSettings();

    expect(await screen.findByRole("heading", { name: "共享服务端口" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "算力池路由接入" })).toBeInTheDocument();
    expect(screen.queryByText("启动时自动运行")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "启用算力池路由接入" }));

    await waitFor(() => expect(setRouteAccess).toHaveBeenCalledWith(false));
    expect(stopWebServer).not.toHaveBeenCalled();
  });

  it("keeps server host, port, and listener lifecycle read-only in standalone mode", async () => {
    vi.mocked(isDesktop).mockReturnValue(false);

    renderSettings();

    expect(await screen.findByText("由服务器进程和环境变量管理")).toBeInTheDocument();
    expect(screen.queryByLabelText("监听地址")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("服务端口")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "启动服务端口" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "停止服务端口" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "启用算力池路由接入" })).toBeEnabled();
  });

  it("asks before opening the listener to the network, then saves the permission and the host together", async () => {
    renderSettings();

    const toggle = await screen.findByLabelText("允许局域网访问");
    expect(toggle).not.toBeChecked();

    // Flipping it on does not commit. The warning comes first and the checkbox
    // still reads from the config while it is up, so there is no state in which
    // the permission is set but nothing said so.
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/本网络内任何设备都能访问/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "我明白，开启" }));
    expect(toggle).toBeChecked();
    // The switch owns the host as well, so the two can never disagree.
    expect(screen.getByDisplayValue("0.0.0.0")).toBeInTheDocument();
    expect(screen.getByText(/局域网访问已开启/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(saveWebServiceConfig).toHaveBeenCalledWith(
        expect.objectContaining({ allowLanAccess: true, host: "0.0.0.0" }),
      ),
    );
  });

  it("returns the listener to loopback when LAN access is turned back off", async () => {
    vi.mocked(getWebServiceConfig).mockResolvedValue({
      host: "0.0.0.0",
      port: 19527,
      token: "0123456789abcdef",
      routeAccessEnabled: true,
      tailscaleEnabled: false,
      tailscaleExposureMode: "private",
      tlsEnabled: false,
      tlsCertPath: null,
      tlsKeyPath: null,
      allowLanAccess: true,
    });

    renderSettings();

    const toggle = await screen.findByLabelText("允许局域网访问");
    expect(toggle).toBeChecked();

    // Turning it off needs no confirmation: it narrows the exposure.
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByDisplayValue("127.0.0.1")).toBeInTheDocument();
  });
});
