# 移动端 UI 重做：开发进度

> 本文件记录 `mobile-ui-rewrite` 分支的实施进度与每轮验证结论，供交接与续做使用。
> 设计依据见 [2026-09-21-mobile-ui-rewrite-design.md](./2026-09-21-mobile-ui-rewrite-design.md)。

## 分支与验证方式

- 分支：`mobile-ui-rewrite`（基线 `android` 分支 `53e3ac3`）
- 远程：`origin` → `fplj-fplj/ai-switch`
- **验证全部在 GitHub Actions 做**：`desktop-regression`（typecheck + 全量 vitest + cargo test + server:check）、
  `android-cross-check`（`cargo check --target aarch64-linux-android`）、`android-apk`（产物供侧载）。
  本机不跑 `pnpm typecheck` / `pnpm test:run` / 构建；只读探针（UnoCSS 类名生成检查）例外。
- APK 由 CI 产出，人工下载侧载；`cancel-in-progress: true`，等 APK 时不要推新提交。

## 阶段进度

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P0 隔离骨架 | ✅ 完成 | `ApplicationEntry` 按 `isMobileApp()` 分叉；`src/mobile/` 壳；桌面端仍渲染 `App` |
| P1 设计 token | ✅ 完成 | `src/styles/tokens.css`（20 个语义变量）+ `uno.config.ts` 主题映射；`tests/designTokens.test.ts` 钉住语义色与 Radix 属性语法 |
| P1 ui-kit 组件 | ✅ 完成 | Button、ListItem、Sheet、Tabs、Switch + `tests/uiKitClassNames.test.ts` |
| P2 共享常量提取 | ⬜ 未开始 | 唯一触碰桌面文件（`AccountsScreen.tsx`）的阶段，需单独提交 |
| P3 移动端壳 | ⬜ 未开始 | 底部导航、安全区、返回键（复用 `src/lib/backHandler.ts`） |
| P4 网关页 | ⬜ 未开始 | 实时日志环形缓冲 50 条 + 「查看全部」面板 |
| P5 凭据页 | ⬜ 未开始 | 工作量主体，可再分 2–3 个提交 |
| P6 用量页 | ⬜ 未开始 | |
| P7 设置页 | ⬜ 未开始 | |
| P8 清理与回归 | ⬜ 未开始 | 全量测试 + 桌面端 `git diff` 复核 |

## P1 ui-kit 落地说明

目录 `src/components/ui-kit/`，与桌面 `src/components/ui/` 完全隔离（桌面端零引用）。

- **Button**：`cva` 变体（primary / secondary / ghost / destructive × sm / md / lg / icon），`asChild` 走 Radix `Slot`。
- **ListItem**：行基元 + `ListItemMain/Title/Subtitle/Leading/Trailing` 槽位，`interactive` 变体给按压反馈。
- **Sheet**：Radix Dialog 封装的底部抽屉（`max-h-[85dvh]`，头部/正文/底栏分离，滚动只在 `SheetBody`）。
- **Tabs**：Radix Tabs，触发态挂 `data-[state=active]`。
- **Switch**：Radix Switch，选中态挂 `data-[state=checked]`。

### 一条必须记住的约束：语义 token 不能用 alpha 修饰符

`uno.config.ts` 把语义色直接映射成 `var(--x)`，UnoCSS **无法**在其上合成透明度。实测：

```
bg-primary/90     => background-color:var(--primary);    ← alpha 被静默丢弃
bg-destructive/10 => background-color:var(--destructive); ← 同上
bg-black/50       => background-color:rgb(0 0 0 / 0.5);   ← 调色板色正常保留 alpha
```

类名能生成、样式却是错的——这是最难发现的一类错误。因此 ui-kit 的按压反馈一律改用
`active:opacity-90` / `active:brightness-95` / 实色互换（`active:bg-accent`），遮罩用 `bg-black/50`。
`tests/uiKitClassNames.test.ts` 用一条正则守卫把这条规律钉死，防止将来有人写回 `/90`。

### 测试策略

`tests/uiKitClassNames.test.ts` 只做类名生成断言，**不渲染组件**：Radix 的 portal/presence 在本仓库
jsdom 环境从未跑过，未经验证的渲染测试会把整批提交的信号押在未知风险上。类名提取走两条正交路径——
静态字面量正则（`className="..."` / `clsx("..."` / `cva("..."`）与真实 `cva` 变体枚举，
并各带空跑守卫；变体枚举是唯一能覆盖对象字面量里类名的方式。

## 待办 / 遗留

- **P5+ 才需要的原语**：`@radix-ui/react-popover` / `-dropdown-menu` / `-scroll-area` / `-tooltip`
  依赖已随本轮 lockfile 装好（一次 `--lockfile-only` 生成，避免将来为单个包再烧一轮 CI），
  但**尚未**写对应组件——等真正有屏幕用到时再包，避免死代码。
- `SheetClose` 的默认 `aria-label="关闭"` 是硬编码中文（与 `MobileApp.tsx` 里的临时字符串同性质），
  P3 引入 i18n 键后由调用方传入覆盖。
- 真机验证仍未做过：APK 从未在设备上运行过，样式与交互的目视核对留待有设备时。
