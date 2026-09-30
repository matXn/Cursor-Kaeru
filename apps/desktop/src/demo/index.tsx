import { installDemoApi } from "./api";

installDemoApi();

const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") === "en-US" ? "en-US" : "zh-CN";
const theme = params.get("theme") === "default-light" ? "default-light" : "default-dark";

const platform = params.get("platform");
document.documentElement.dataset.platform = platform === "windows" || platform === "linux" ? platform : "macos";
localStorage.setItem("cursor-byok.locale", locale);
localStorage.setItem("cursor-byok.theme", theme);

void import("../index");
