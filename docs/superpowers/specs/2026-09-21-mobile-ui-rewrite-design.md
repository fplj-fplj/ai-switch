# 移动端 UI 按实现逻辑重写设计

日期：2026-09-21

状态：待评审

## 目标

现有界面的组织方式是**按 CLI 平台分列**：顶层导航里 `Codex`、`Claude`、`Grok`、`Gemini`、`OpenCode`、`OpenClaw`、`Hermes` 是七个并列入口。但软件的实现逻辑里没有「七个应用」这回事——只有：

- **一个算力池**（`route_pool_repository`、`route_pool_groups`）
- **一张凭据表**，`platform` 只是其中一个列（`route_credential_repository`）
- **一份用量流水**（`usage_events`）
- **一组池级访问 key**（`route_proxy_key_repository`）

七个入口渲染的是**同一个组件**，只是 `platform` 参数不同：

```ts
// src/components/layout/AppLayout.tsx:98
const agentItems: AgentNavItem[] = [
  { icon: "codex",  screen: "Codex",  platform: "codex" },
  { icon: "claude", screen: "Claude", platform: "claude" },
  // …共 7 项
];
```

```tsx
// src/App.tsx:242 — 七个 screen 名走同一个分支
{agentPlatform && (
  <AccountsScreen platform={agentPlatform} … />
)}
```

那个组件的规模是**一个应用而不是一个页面**：

| 指标 | 值 |
| --- | --- |
| 行数 | 10,090 |
| `useState` | 136 |
| `useEffect` | 29 |
| `useMemo` | 11 |

池成员管理、凭据增删改、用量统计、实时日志、中转站余额、模型映射、模型定价、导入导出、配置写入目标——全部在同一个函数组件里。

本次把移动端界面**按后端资源的真实边界重新组织**：平台从「顶层入口」降级为「凭据列表上的一个筛选器」，七个入口合并为一个凭据页。桌面端保持现状。

## 范围

**做：**

- 新增一套移动端专用界面，导航按功能域组织：**网关 / 凭据 / 用量 / 设置**。
- 引入 Radix 无样式原语作为交互底座，建立 CSS 变量语义 token 层。
- 把「对话框」形态改为移动端适配的「全屏面板」形态。
- 新增移动端界面自己的测试。

**不做：**

- **不改桌面端任何界面代码。** 桌面端继续走现有 `App.tsx` 与 `AppLayout.tsx`。
- **不改任何 Rust 代码。** 现有 79 个移动端命令够用，本次纯前端。
- **不做深链（deeplink）导入。** 移动端没有注册这个能力：`AndroidManifest.xml` 里没有 `intent-filter`，`mobile.rs` 也明确是桌面 `run()` 减去 deep links，所以移动端收不到 `aiswitch://` 链接。要支持它得同时改 Rust 与 Manifest，与「本次纯前端」冲突，且需要真机验证 intent 分发。移动端已有更顺手的替代：`import_official_route_credentials_from_text`（粘贴导入）与 `import_external_client_accounts`。
- **不改 `AccountsScreen.tsx` 与 `AppLayout.tsx`。** 桌面端仍在使用，保持逐字节不变。
- 不删除 `VibeScreen.tsx` 等桌面专属界面（它们在桌面端仍在用）。
- 不改 i18n 的语言集合（仍只有 `zh-CN`）。

## 隔离方式：一个分支点

移动端与桌面端的分叉落在**唯一一个文件、唯一一行**上：

```tsx
// src/ApplicationEntry.tsx
export function ApplicationEntry() {
  return isMobileApp() ? <MobileApp /> : <App />;
}
```

`ApplicationEntry.tsx` 现在只有 12 行，且已经是一个薄包装（SaaS 插件删除后遗留的空壳）：

```tsx
export function ApplicationEntry() {
  return <App />;
}
```

选这里而不是 `App.tsx` 内部的原因是**避免破坏 Hooks 规则**：`App()` 的 8 个 `useState` 与 4 个 `useEffect` 都在函数体开头，任何提前 `return` 都要把它们拆出去重排，改动面立刻扩大到桌面端。在 `ApplicationEntry` 分支则是在挂载前决定渲染哪棵树，两棵树各自独立、各自合法。

`isMobileApp()`（`src/lib/platform.ts:26`）已有正确语义——它认的是「打包的 Android 应用」，而不是 `isDesktop()` 那个「是否在 Tauri 里」（后者在 Android 上同样为真）。浏览器与独立服务器下它返回 `false`，走桌面分支，行为不变。

### 目录布局

```
src/mobile/                     ← 新增，移动端专属
  MobileApp.tsx                 ← 壳：底部导航 + 安全区 + 返回键
  shell/                        ← 导航、标题栏、页面容器
  screens/                      ← 四个目的地
  sheets/                       ← 移动端全屏面板
  hooks/                        ← 数据访问（TanStack Query 封装）
src/components/ui-kit/          ← 新增，Radix 封装 + 语义 token 组件
```

`src/screens/`、`src/components/layout/` 等现有目录**不动**。

## 为什么重写前端不会造成行为分叉

这是本次改动成立的前提，需要单独说明。

**业务逻辑不在前端。** 选号、失败判定、重试、并发租约、记账、协议桥接、客户端指纹伪装，全部在 `src-tauri/src/services/route_proxy_service.rs`（14,238 行）与 `route_protocol_bridge/`（12 个模块）里。移动端与桌面端**链接的是同一份 Rust 代码**，走的是同一批命令。

`AccountsScreen.tsx` 的 10,090 行里，绝大部分是**展示逻辑与表单状态**：`accountStatusLabel`、`accountStatusClass`、`modelIssueLabel`、`LiveLogStage`、各种 `Dialog` 的开关与校验。这些重写不会改变网关行为。

**但有两类前端代码承载了真实规则，必须原样搬运而不是重新发明：**

1. **默认值常量** —— `DEFAULT_MAX_CONCURRENCY = 5`、`DEFAULT_ROUTE_CREDENTIAL_COOLDOWN_SECONDS = 10`、`MAX_ROUTE_CREDENTIAL_COOLDOWN_SECONDS = 86_400`、`COOLDOWN_ADJUST_STEPS = [-300, -60, 60, 300, 1800]`、`defaultRouteCredentialFailurePolicy`。
2. **判定函数** —— `credentialModelIssues`（凭据模型可用性）、`transientFailureTag`（瞬时失败标记）、`terminalAccountStatuses = {"error","revoked","paused"}`、`modelStateIsClearable`。

这些是从 `src/screens/AccountsScreen.tsx` 里**提取到共享模块**（`src/lib/credentialDisplay.ts` 之类），由桌面端与移动端共同引用。提取时逐字复制，不改逻辑；桌面端只是把内联定义换成 `import`，渲染结果不变。**这一步会碰到 `AccountsScreen.tsx`，是本方案唯一触碰桌面文件的地方**，单独成一个提交，便于二分。

## 信息架构

### 四个目的地

底部导航四项（`<600px` 已有 `SIDEBAR_DRAWER_BREAKPOINT` 的先例，沿用同一断点）：

| 目的地 | 后端依据 | 承载 |
| --- | --- | --- |
| **网关** | `route_proxy_commands`：`get_route_proxy_status`、`start_route_proxy`、`stop_route_proxy`、`get_route_proxy_key`、`subscribe_route_proxy_live_log`、`set_route_access` | 运行状态、监听端口、访问 key、启停、实时日志、池内模型聚合列表 |
| **凭据** | `route_credential_commands`（23 个）+ `route_pool_commands`（12 个） | 凭据列表、新建/编辑、池成员管理、分组、状态与冷却、配额与余额刷新、导入导出 |
| **用量** | `usage_stats_commands`：`get_usage_overview`、`get_session_usage_stats`、`get_model_price_configs`、`save_model_price_configs` | 总览、趋势、按凭据/模型拆分、价格配置 |
| **设置** | `settings_commands`、`web_service_commands`、`notification_commands`、`disk_space_commands`、`platform_commands` | 端口与访问、通知、存储、关于、诊断 |

网关排在首位：手机上这个应用的首要职责是**让网关活着**，而不是管理凭据。

### 现有 16 个 screen 的归并

| 现有 screen | 去向 |
| --- | --- |
| `Codex`/`Claude`/`Grok`/`Gemini`/`OpenCode`/`OpenClaw`/`Hermes` | 合并进**凭据**，平台成为筛选器 |
| `Dashboard` | 并入**网关**（它就是运行总览） |
| `Batches` | 并入**凭据**（批量操作是列表的一个模式） |
| `Providers` | 并入**凭据**（provider 是凭据的一种来源） |
| `Imports` | 降级为**凭据**页的导入动作（面板，不是页面） |
| `CryptoTools` | 并入**设置 → 工具** |
| `Log` | 并入**设置 → 诊断** |
| `About` | 并入**设置 → 关于** |
| `Settings` | 保留为**设置** |
| `Vibe`/`OCR`/`MCP`/`Skills`/`Updates`/`Sessions`/`Targets`/`ImageGen` | 移动端已隐藏（`MOBILE_HIDDEN_SCREENS`），新导航不再列出 |

`MOBILE_HIDDEN_SCREENS` 机制**保留不动**——它服务于桌面端的 `isScreenAvailable` 调用点，与移动端新导航无关。

## 组件库选型

### 结论

**Radix 无样式原语 + 自建薄封装 + CSS 变量语义 token。不引入 Tailwind，不运行 shadcn CLI。**

### 依据（均为本机实测）

**一、`presetUno` 已能吃下 shadcn 的类名与 Radix 的变体语法。**

用项目已装的 `unocss@66.7.5` 建生成器，注入一组 CSS 变量主题后探测：

```
===== presetUno =====                    ===== presetWind4 =====
语义色  CSS=732B   未匹配: 无              语义色  CSS=1836B  未匹配: 无
变体    CSS=1514B  未匹配: animate-out*    变体    CSS=2430B  未匹配: animate-out*
```

命中的包括 `bg-background`、`text-muted-foreground`、`bg-primary`、`text-primary-foreground`、`border-input`、`bg-card`、`ring-ring`，以及 Radix 依赖的 `data-[state=open]:bg-accent`、`aria-expanded:rotate-180`、`[&_svg]:size-4`、`min-[600px]:grid-cols-2`、`supports-[backdrop-filter]:bg-white/60`。

唯一未命中的 `data-[state=closed]:animate-out` 是 shadcn 自定义动画键，不是 preset 能力缺口——在 `uno.config.ts` 里补一条 `theme.animation` 即可。

**所以不换 preset。** 换成 `presetWind4` 会重算桌面端 16,601 行里的全部原子类，与「桌面零改动」直接冲突，而收益为零。

**二、Radix 与 UnoCSS 不冲突。** Radix 是 headless 原语，只提供行为与 `data-*` / `aria-*` 属性，不附带任何样式，因此不涉及 CSS 引擎之争。`@radix-ui/react-dialog` 在 registry 上可达（实测 `1.1.23`）。

**三、shadcn CLI 在本仓库跑不通，但其组件源码可用。** CLI 依赖 `components.json` 与 Tailwind 配置；本仓库 `uno.config.ts` 只有 5 行（`presets: [presetUno()]`）。所以**手工搬运** shadcn 的组件实现：类名原样保留（UnoCSS 认得），只改主题注入方式。

### 新增依赖

| 包 | 用途 |
| --- | --- |
| `@radix-ui/react-dialog` | 全屏面板底座（移动端替代对话框） |
| `@radix-ui/react-tabs` | 凭据详情分页 |
| `@radix-ui/react-switch` | 布尔设置项 |
| `@radix-ui/react-popover` / `-dropdown-menu` | 筛选器、行内操作菜单 |
| `@radix-ui/react-tooltip` | 桌面端不引入，仅移动端 |
| `@radix-ui/react-scroll-area` | 长列表滚动容器 |
| `@radix-ui/react-slot` | `asChild` 组合 |
| `class-variance-authority` | 组件变体定义（纯 TS，与 CSS 引擎无关） |

`clsx` 已有。`tailwind-merge` 可选——它是纯字符串处理，与 UnoCSS 兼容，用于 cva 的类名去重。

**体积注意**：交接文档记录的 APK 产物约 18 MB（本机无实物，未复核）。Radix 各包为独立 tree-shakable ESM，按需引入后增量应在数十 KB 量级，但**需要在 `android-apk` 作业产出后核对实际增量**。

### 语义 token

新增 `src/styles/tokens.css`，定义 CSS 变量（`--background`、`--foreground`、`--primary`、`--muted`、`--accent`、`--destructive`、`--border`、`--input`、`--ring`、`--card`），`uno.config.ts` 里映射为 `theme.colors`。

**只新增，不修改现有 token。** 桌面端不引用这些变量，因此不受影响。

### 验证盲区（必须说明）

**本机没有浏览器，也没有真机。** UnoCSS 与 Tailwind 的类名并非 100% 等价（个别工具类语义不同），搬运 shadcn 组件时的样式正确性**无法在本机目视验证**。可验证的只有 `pnpm typecheck` 与 `pnpm test:run`。

因此搬运组件时遵守：**只用实测已命中的类名**（上文列出的那些），不引入未探测过的 Tailwind 专有语法。每个新组件补一条断言「类名出现在生成的 CSS 里」的测试，把「类名是否被 UnoCSS 认下」这件事从目视变成可测。

## 凭据页的拆解

这是工作量主体。现有 `AccountsScreen` 的分解线索已经内嵌在代码里：

```ts
type AccountView = "in_pool" | "out_of_pool" | "archived" | "stats";  // 四个视图
type CreateMode  = "api" | "official" | "external";
type CreateTab   = "basic" | "advanced";
type EditTab     = "basic" | "advanced" | "failure" | "other";        // 四个分页
```

拆成：

| 模块 | 职责 | 现有对应物 |
| --- | --- | --- |
| `PlatformFilterChips` | 顶部横滑平台筛选 chips | 现有七个顶层入口的等价物 |
| `CredentialList` | 列表 + 视图切换 | `AccountView` 四态 + `accountLayoutOptions` |
| `CredentialDetail` | 全屏面板，四个分页 | `EditTab` + `FormTabs` |
| `CredentialCreate` | 两步向导 | `CreateMode` + `CreateTab` |
| `PoolMembership` | 池成员、分组、排序、移动 | `RoutePoolAction` |
| `QuickEditSheet` | 高频字段（状态、冷却、并发） | `QuickEditDialog` |
| `UsagePanel` | 该凭据的用量与趋势 | `UsageOverviewPanel` + `UsageTrendChart` |
| `RelayBalance` | 中转站余额刷新 | `refresh_route_credential_relay_balance` |
| `ModelMapping` | 模型映射与定价 | `ModelMappingSummary` + `ModelPricingDialog` |
| `TransferSheet` | 导入导出 | `RouteCredentialExportDialog` / `RouteCredentialImportDialog` |

### 两个维度的取舍：状态做主切换，平台做 chips

凭据页有两个正交维度——**状态**（`AccountView` 四态：池内 / 池外 / 归档 / 统计）与**平台**（七选一）。移动端屏幕只容得下一个主切换，因此：

- **状态**做主导航（分段控件），因为它是「我要看哪一类」的粗筛。
- **平台**做顶部一行横滑 chips，因为它是日常最高频的切换动作，藏进筛选面板会多两步。

**chips 只显示池内实际存在的平台**，不是固定七个。固定七项会导致常年有四个空 chips 占据屏幕，而实际配置通常只涉及 1–3 个平台。

不做「按平台分组的折叠视图」：那会让两个维度抢同一块屏幕，手机上要滚动两层，而分组视图的价值（分组多且每组都长）在这个数据形态下不成立。

### 形态变化：对话框 → 全屏面板

移动端最大的一处交互改动。现有实现用 4 个分页的对话框承载凭据编辑，在 6 英寸屏上不可用。改为 Radix `Dialog` + 全屏内容区，分页用 `Tabs` 顶部横滑，底部固定操作条。

### 网关页的实时日志上限

默认只渲染**最近 50 条**，底部「查看全部」进全屏面板看完整历史与原始报文。

两个理由：一是日志条目带完整报文（`LiveLogStage` 渲染 `client_request` / `target_url`，`AccountsScreen.tsx:514`），单条可能很长，50 条在手机上已需滚好几屏；二是网关页是**常驻页面**，无限累积会持续吃内存，且每个新条目都触发重渲染。因此用**环形缓冲**（固定容量、原地覆盖），而不是对累积数组做 `slice`——后者每次推送都新建数组，等于把内存问题换个地方。

## 数据访问层

现有 `src/lib/api/` 只有 5 个文件（`client.ts`、`commandSupport.ts`、`errorMessages.ts`、`errors.ts`、`types.ts`），命令调用是**按名散落**的。移动端新增 `src/mobile/hooks/`，按功能域封装 TanStack Query：

- `useRouteProxyStatus()`、`useRouteProxyLiveLog()`（订阅式）
- `useCredentials(filter)`、`useCredentialMutations()`
- `useRoutePool()`、`useRoutePoolMutations()`
- `useUsageOverview(range)`、`useModelPrices()`

**不改 `src/lib/api/` 现有内容**，只在其上封装。桌面端不受影响。

## 实施阶段

每个阶段独立可验证（`pnpm typecheck` + `pnpm test:run`），独立提交。

| 阶段 | 内容 | 验证 |
| --- | --- | --- |
| **P0** | 隔离骨架：`ApplicationEntry` 分支 + `src/mobile/` 空壳 + 一条「桌面端仍渲染 `App`」的测试 | typecheck + 测试；桌面测试全绿 |
| **P1** | 设计 token + `uno.config.ts` 主题映射 + `ui-kit` 首批组件（Button、Sheet、Tabs、Switch、ListItem）+ 类名生成断言 | 类名断言测试 |
| **P2** | 提取共享常量与判定函数到 `src/lib/`，`AccountsScreen.tsx` 改为引用 | **桌面测试必须逐条保持通过**（唯一触碰桌面文件的阶段） |
| **P3** | 移动端壳：底部导航、安全区、返回键集成 | 导航测试 |
| **P4** | 网关页 | 状态渲染测试 |
| **P5** | 凭据页（工作量主体，可再分 2–3 个提交） | 列表/详情/表单测试 |
| **P6** | 用量页 | 图表与聚合测试 |
| **P7** | 设置页 | 设置项测试 |
| **P8** | 清理与回归 | 全量测试 + 桌面端 `git diff` 复核 |

## 风险

| 风险 | 处置 |
| --- | --- |
| **样式正确性无法本机验证** | 只用实测命中的类名；补类名生成断言；真机核对留待有设备时 |
| **P2 触碰桌面文件** | 单独提交、逐字搬运、不重命名不改逻辑；桌面测试是判据 |
| **APK 体积增长** | Radix 按需引入；`android-apk` 产出后核对增量 |
| **返回键与导航状态** | 复用现有 `src/lib/backHandler.ts` 的 `runTopBackHandler`，不另造机制 |
| **`MOBILE_HIDDEN_SCREENS` 与新导航重叠** | 两者职责不同（前者管桌面端可达性判定），保留不动；新导航不引用它 |
| **i18n 键膨胀** | 新界面按功能域加键；不复用语义不符的旧键 |
| **两套界面长期分叉** | 业务逻辑在 Rust，天然不分叉；前端仅展示层重复。若将来要收敛，可反向把移动端组件提升为共用 |

## 已决问题

评审中确认的四项，均已写入上文对应章节：

1. **凭据页的平台维度** → **平台筛选 chips + 平铺列表**，不做按平台分组的折叠视图。状态（`AccountView` 四态）做主切换，平台做 chips。理由见「两个维度的取舍」。
2. **平台快捷 chips** → **做**，且**只显示池内实际存在的平台**，不是固定七项。理由见同上。
3. **网关页实时日志** → 默认**最近 50 条** + 「查看全部」全屏面板，用环形缓冲实现。理由见「网关页的实时日志上限」。
4. **深链导入** → **本次不做**，已写入「不做」清单并注明原因（移动端未注册该能力，需改 Rust 与 Manifest，且需真机验证）。

## 评审状态

- 2026-09-21：方向变更与方案初稿，待评审。
- 2026-09-21：四个未决问题经评审确认，方案定稿待开工。

**开工前请确认**：`P0` 之前无阻塞项；`P2` 是唯一触碰桌面文件的阶段，建议单独评审。
