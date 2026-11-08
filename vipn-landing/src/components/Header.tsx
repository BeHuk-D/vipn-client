import { useI18n } from "../i18n";
import { Crown } from "./Crown";

export function Header() {
  const { lang, setLang, s } = useI18n();
  const onDownloadPage = window.location.pathname.startsWith("/downloads");
  const home = onDownloadPage ? "/" : "";
  const downloadHref = "/downloads/";
  const brandHref = onDownloadPage ? "/" : "#top";

  return (
    <header className="site-head rail">
      <div className="wrap nav">
        <a className="brand" href={brandHref}>
          <Crown />
          <span>ViPN</span>
        </a>
        <nav className="nav-links" aria-label={s.navLabel}>
          <a href={`${home}#features`}>{s.nav.features}</a>
          <a href={`${home}#pricing`}>{s.nav.pricing}</a>
          <a href={downloadHref}>{s.nav.download}</a>
        </nav>
        <div className="lang" role="group" aria-label={s.langLabel}>
          <button type="button" aria-pressed={lang === "ru"} onClick={() => setLang("ru")}>
            RU
          </button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
        </div>
        <a className="login-link" href="/account/">
          {s.actions.login}
        </a>
        <a className="btn btn-primary btn-small" href={downloadHref}>
          {s.actions.download}
        </a>
      </div>
    </header>
  );
}
