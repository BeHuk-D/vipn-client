import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles.css";

const root = document.getElementById("root");

if (!root) throw new Error("Root element is missing");

const referralCode = new URLSearchParams(window.location.search).get("ref");
if (referralCode && /^[a-z0-9]{4,16}$/i.test(referralCode.trim())) {
  try {
    localStorage.setItem("vipn_ref", referralCode.trim().toLowerCase());
  } catch {}
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
