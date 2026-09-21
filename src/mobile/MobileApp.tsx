/**
 * The mobile shell.
 *
 * Android gets its own tree instead of a responsive variant of `App`, because the
 * two are organised around different things. The desktop panel is laid out by CLI
 * platform: seven top-level entries (`Codex`, `Claude`, `Grok`, …) that all render
 * the same `AccountsScreen` with a different `platform` prop. What the backend
 * actually holds is one compute pool, one credential table and one usage stream —
 * the seven platforms are a column in that table, not seven applications. Rewriting
 * the navigation around those resources is the point of this tree, and doing it
 * inside `App` would have dragged the desktop layout along with it.
 *
 * The branch that chooses this tree lives in `ApplicationEntry`, not in `App`:
 * `App()` opens with eight `useState` and four `useEffect`, so an early `return`
 * there would have to come after all of them, and hoisting them out to satisfy the
 * rules of hooks is a much larger change to a file the desktop still uses.
 *
 * What is here now is the skeleton only — the real shell (bottom navigation,
 * safe-area insets, the Android back button) arrives with it. It renders the four
 * destinations as a static preview so the information architecture can be looked at
 * on a device before any of it is built, and so the APK built from this commit is
 * not simply blank.
 */
const DESTINATIONS = [
  { title: "网关", detail: "运行状态、端口、访问 key、启停、实时日志" },
  { title: "凭据", detail: "凭据列表与详情、池成员与分组、导入导出（平台降级为筛选器）" },
  { title: "用量", detail: "总览与趋势、按凭据/模型拆分、价格配置" },
  { title: "设置", detail: "端口与访问、通知、存储、关于、诊断" },
];

export function MobileApp() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-stone-950">
      <header className="border-b border-stone-200 bg-white px-4 py-3">
        <p className="text-[15px] font-semibold">AI Switch</p>
        <p className="text-[12px] text-stone-500">移动端界面重写中</p>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        <p className="text-[12px] text-stone-500">
          这是新版移动端界面的骨架。下面四个入口按后端资源的真实边界划分，尚未接入功能。
        </p>

        <ul className="space-y-2">
          {DESTINATIONS.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-stone-200 bg-white px-3 py-3 shadow-sm"
            >
              <p className="text-[14px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[12px] text-stone-500">{item.detail}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
