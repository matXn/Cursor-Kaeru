import ReactDOM from "react-dom/client";
import "../node_modules/monaco-editor/min/vs/editor/editor.main.css";
import { I18nRoot } from "./i18n/I18nRoot";
import { initializeI18n } from "./i18n/store";
import { appStore } from "./shared/store/appStore";
import { applyTheme } from "./shared/theme/theme";
// GitHub typefaces (OFL): Mona Sans for UI text, Monaspace Neon for numbers and code.
// Outfit (OFL) for page titles only.
import "@fontsource/mona-sans/400.css";
import "@fontsource/mona-sans/500.css";
// Display numbers and titles only (the engraved total, the range block, page titles).
import "@fontsource/mona-sans/600.css";
import "@fontsource/outfit/500.css";
import "@fontsource/monaspace-neon/400.css";
import "@fontsource/monaspace-neon/500.css";
import "./styles/globals.scss";

initializeI18n();
applyTheme(appStore.getSnapshot().theme);
void appStore.refresh();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <I18nRoot />,
);
