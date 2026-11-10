import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DownloadPage } from "./components/DownloadPage";
import { I18nProvider } from "./i18n";
import { useReveal } from "./useReveal";
import "./styles.css";

function Root() {
  useReveal();
  return <DownloadPage />;
}

const root = document.getElementById("root");

if (!root) throw new Error("Root element is missing");

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </StrictMode>,
);
