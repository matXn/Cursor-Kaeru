import "@fontsource/mona-sans/400.css";
import "@fontsource/mona-sans/500.css";
import "@fontsource/outfit/500.css";
import "./setup.scss";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** What the Rust side found before anything is installed. */
type Plan = { version: string; install_dir: string; installed_version: string | null };
type Theme = "default-dark" | "default-light";
type Locale = "zh-CN" | "en-US";

// welcome (where) ──► options (how) ──► installing ──► done | failed
type Step =
  | { kind: "welcome" }
  | { kind: "options" }
  | { kind: "installing" }
  | { kind: "done" }
  | { kind: "failed"; error: string };

// The options page speaks like a Windows setup screen on purpose.
const strings = {
  "zh-CN": {
    title: "安装 Cursor Kaeru",
    stepOf: (step: number) => `第 ${step} 步，共 2 步`,
    version: (version: string) => `版本 ${version}`,
    update: (from: string, to: string) => `将从 ${from} 更新到 ${to}`,
    location: "安装位置",
    change: "更改",
    runningNote: "安装时会关闭正在运行的 Cursor Kaeru，配置与调用记录保留。",
    next: "下一步",
    back: "上一步",
    optionsTitle: "自定义你的设置",
    optionsNote: "选择以下选项以个性化你的 Cursor Kaeru 体验。你可以随时在“设置”中更改这些选项。",
    desktopShortcut: "在桌面上创建快捷方式，以便你可以更快地访问 Cursor Kaeru。",
    autostart: "当你登录到 Windows 时，允许 Cursor Kaeru 自动启动。",
    mode: "选择你的模式",
    light: "浅色",
    dark: "深色",
    language: "选择你的显示语言",
    install: "安装",
    installing: "请稍候，我们正在为你安装 Cursor Kaeru…",
    done: "一切就绪",
    doneNote: "Cursor Kaeru 已成功安装到你的设备上。你可以从“开始”菜单或桌面打开它。",
    finish: "完成",
    launch: "启动 Cursor Kaeru",
    failed: "出现了一些问题",
    retry: "重试",
    close: "关闭",
    minimize: "最小化",
  },
  "en-US": {
    title: "Install Cursor Kaeru",
    stepOf: (step: number) => `Step ${step} of 2`,
    version: (version: string) => `Version ${version}`,
    update: (from: string, to: string) => `Updates ${from} to ${to}`,
    location: "Install location",
    change: "Change",
    runningNote: "A running Cursor Kaeru will be closed; settings and call history are kept.",
    next: "Next",
    back: "Back",
    optionsTitle: "Customize your settings",
    optionsNote: "Choose the options below to personalize your Cursor Kaeru experience. You can change these at any time in Settings.",
    desktopShortcut: "Create a shortcut on the desktop so you can get to Cursor Kaeru faster.",
    autostart: "Let Cursor Kaeru start automatically when you sign in to Windows.",
    mode: "Choose your mode",
    light: "Light",
    dark: "Dark",
    language: "Choose your display language",
    install: "Install",
    installing: "Hang tight while we install Cursor Kaeru for you…",
    done: "You're all set",
    doneNote: "Cursor Kaeru was installed on your device. Open it from Start or the desktop.",
    finish: "Done",
    launch: "Open Cursor Kaeru",
    failed: "Something went wrong",
    retry: "Try again",
    close: "Close",
    minimize: "Minimize",
  },
} as const;

const app = document.querySelector<HTMLDivElement>("#app")!;
const window_ = getCurrentWindow();
let plan: Plan;
let installDir = "";
let step: Step = { kind: "welcome" };
const options = {
  desktopShortcut: true,
  autostart: false,
  theme: "default-dark" as Theme,
  locale: (navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US") as Locale,
};
const text = () => strings[options.locale];

const escape = (value: string) => value.replace(/[&<>"]/g, (char) => `&${({ "&": "amp", "<": "lt", ">": "gt", '"': "quot" } as const)[char as "&"]};`);
// The app icon's nine cells, deep clay to peach; while installing they glow in turn.
const logo = `<div class="logo" aria-hidden="true">${"<i></i>".repeat(9)}</div>`;

function go(next: Step) {
  step = next;
  render();
}

// The installer previews the chosen theme and speaks the chosen language right away.
function applyLook() {
  document.documentElement.dataset.theme = options.theme;
  document.documentElement.lang = options.locale;
  void window_.setTheme(options.theme === "default-light" ? "light" : "dark");
}

function render() {
  const t = text();
  app.dataset.step = step.kind;
  app.innerHTML = `
    <header data-tauri-drag-region>
      <span data-tauri-drag-region>${t.title}</span>
      <div class="window">
        <button type="button" data-action="minimize" aria-label="${t.minimize}"><svg viewBox="0 0 10 10"><path d="M1 5h8"/></svg></button>
        <button type="button" data-action="close" aria-label="${t.close}" ${step.kind === "installing" ? "disabled" : ""}><svg viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg></button>
      </div>
    </header>
    <main data-tauri-drag-region>
      ${logo}
      <section>${body()}</section>
    </main>`;
}

function body() {
  const t = text();
  const heading = `<h1>Cursor Kaeru</h1>`;
  const choice = (name: string, value: string, label: string, current: string) =>
    `<button type="button" data-choice="${name}" data-value="${value}" aria-pressed="${value === current}">${label}</button>`;
  switch (step.kind) {
    case "welcome": {
      const updating = plan.installed_version && plan.installed_version !== plan.version;
      return `${heading}
        <p class="meta">${updating ? t.update(plan.installed_version!, plan.version) : t.version(plan.version)}</p>
        <label class="field">
          <span>${t.location}</span>
          <span class="path"><input value="${escape(installDir)}" spellcheck="false" data-input="dir" /><button type="button" class="link" data-action="choose">${t.change}</button></span>
        </label>
        ${plan.installed_version ? `<p class="note">${t.runningNote}</p>` : ""}
        <footer><span class="steps">${t.stepOf(1)}</span><button type="button" class="primary" data-action="next">${t.next}</button></footer>`;
    }
    case "options":
      return `<h2>${t.optionsTitle}</h2>
        <p class="note lead">${t.optionsNote}</p>
        <label class="check"><input type="checkbox" data-input="desktopShortcut" ${options.desktopShortcut ? "checked" : ""} /><i></i><span>${t.desktopShortcut}</span></label>
        <label class="check"><input type="checkbox" data-input="autostart" ${options.autostart ? "checked" : ""} /><i></i><span>${t.autostart}</span></label>
        <div class="choice"><span>${t.mode}</span><div class="segments">
          ${choice("theme", "default-light", t.light, options.theme)}${choice("theme", "default-dark", t.dark, options.theme)}
        </div></div>
        <div class="choice"><span>${t.language}</span><div class="segments">
          ${choice("locale", "zh-CN", "简体中文", options.locale)}${choice("locale", "en-US", "English", options.locale)}
        </div></div>
        <footer><span class="steps">${t.stepOf(2)}</span><button type="button" class="secondary" data-action="back">${t.back}</button><button type="button" class="primary" data-action="install">${t.install}</button></footer>`;
    case "installing":
      return `${heading}<p class="meta">${t.installing}</p><div class="progress"><b></b></div><p class="note path-note">${escape(installDir)}</p>`;
    case "done":
      return `${heading}<p class="meta">${t.done}</p><p class="note">${t.doneNote}</p>
        <footer><button type="button" class="secondary" data-action="close">${t.finish}</button><button type="button" class="primary" data-action="launch">${t.launch}</button></footer>`;
    case "failed":
      return `${heading}<p class="meta danger">${t.failed}</p><p class="note error">${escape(step.error)}</p>
        <footer><button type="button" class="secondary" data-action="close">${t.close}</button><button type="button" class="primary" data-action="install">${t.retry}</button></footer>`;
  }
}

async function install() {
  go({ kind: "installing" });
  try {
    await invoke("install", {
      dir: installDir.trim(),
      options: {
        desktop_shortcut: options.desktopShortcut,
        autostart: options.autostart,
        theme: options.theme,
        locale: options.locale,
      },
    });
    go({ kind: "done" });
  } catch (cause) {
    go({ kind: "failed", error: String(cause) });
  }
}

app.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.input === "dir") installDir = input.value;
  if (input.dataset.input === "desktopShortcut") options.desktopShortcut = input.checked;
  if (input.dataset.input === "autostart") options.autostart = input.checked;
});

app.addEventListener("click", async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action], [data-choice]");
  if (!target) return;
  if (target.dataset.choice === "theme") options.theme = target.dataset.value as Theme;
  if (target.dataset.choice === "locale") options.locale = target.dataset.value as Locale;
  if (target.dataset.choice) {
    applyLook();
    return render();
  }
  switch (target.dataset.action) {
    case "minimize": return window_.minimize();
    case "close": return window_.close();
    case "choose": {
      const chosen = await invoke<string | null>("choose_dir", { current: installDir });
      if (chosen) {
        installDir = chosen;
        render();
      }
      return;
    }
    case "next": return go({ kind: "options" });
    case "back": return go({ kind: "welcome" });
    case "install": return install();
    case "launch":
      await invoke("launch", { dir: installDir.trim() });
      return window_.close();
  }
});

plan = await invoke<Plan>("plan");
installDir = plan.install_dir;
applyLook();
render();
