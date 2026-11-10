import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function Header() {
  const { lang, setLang, s } = useI18n();
  const [open, setOpen] = useState(false);
  const onDownloads = window.location.pathname.startsWith("/downloads");
  const home = onDownloads ? "/" : "";
  const brandHref = onDownloads ? "/" : "#top";

  const links = [
    { href: `${home}#features`, label: s.nav.features },
    { href: `${home}#how`, label: s.nav.how },
    { href: `${home}#pricing`, label: s.nav.pricing },
    { href: "/downloads/", label: s.nav.download },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href={brandHref} aria-label="ViPN">
            <Logo />
            <span className="brand-name">ViPN</span>
          </a>

          <nav className="desktop-nav" aria-label={s.navLabel}>
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="header-tools">
            <div className="lang-switch" role="group" aria-label={s.langLabel}>
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

            <a className="btn btn-sm header-cta" href="/downloads/">
              {s.actions.download}
              <Icon name="arrow" />
            </a>

            <button
              className="menu-btn"
              type="button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? s.header.close : s.header.menu}
              onClick={() => setOpen((value) => !value)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="mobile-menu" id="mobile-menu">
          <nav className="mobile-nav" aria-label={s.navLabel}>
            {links.map((link, index) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                <span className="mobile-index">{String(index + 1).padStart(2, "0")}</span>
                {link.label}
                <Icon name="arrow" />
              </a>
            ))}
          </nav>
          <p className="mobile-menu-note">
            <span className="live-dot" />
            {s.hero.eyebrow}
          </p>
          <ul className="mobile-menu-stats">
            {s.stats.items.map((item) => (
              <li key={item.label}>
                <span className="mobile-menu-stat-value">{item.value}</span>
                <span className="mobile-menu-stat-label">{item.label}</span>
                <span className="mobile-menu-stat-sub">{item.sub}</span>
              </li>
            ))}
          </ul>
          <div className="mobile-menu-foot">
            <a className="login-link" href="/account/">
              {s.actions.login}
            </a>
            <a className="btn" href="/downloads/" onClick={() => setOpen(false)}>
              {s.actions.download}
              <Icon name="arrow" />
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
