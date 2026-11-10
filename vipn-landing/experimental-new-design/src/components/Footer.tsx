import { company, documents } from "../company";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function Footer() {
  const { s } = useI18n();
  const onDownloads = window.location.pathname.startsWith("/downloads");
  const home = onDownloads ? "/" : "";
  const brandHref = onDownloads ? "/" : "#top";

  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-top">
          <div className="footer-brand-col">
            <a className="brand footer-brand" href={brandHref} aria-label="ViPN">
              <Logo />
              <span className="brand-name">ViPN</span>
            </a>
            <p className="footer-tagline">{s.footer.tagline}</p>
            <p className="footer-note">{s.footer.note}</p>
          </div>

          <nav className="footer-nav" aria-label={s.navLabel}>
            <a href={`${home}#features`}>{s.nav.features}</a>
            <a href={`${home}#how`}>{s.nav.how}</a>
            <a href={`${home}#pricing`}>{s.nav.pricing}</a>
            <a href="/downloads/">{s.nav.download}</a>
          </nav>

          <nav className="footer-nav footer-docs" aria-label={s.footer.documents}>
            <span className="footer-nav-label">{s.footer.documents}</span>
            {documents.map((doc) => (
              <a key={doc.href} href={doc.href}>
                {doc.label}
              </a>
            ))}
          </nav>

          <div className="footer-contact">
            <a href={company.telegramUrl} target="_blank" rel="noreferrer">
              Telegram
              <Icon name="arrow" />
            </a>
            <a href={`mailto:${company.email}`}>
              {company.email}
              <Icon name="arrow" />
            </a>
          </div>
        </div>

        <div className="footer-word" aria-hidden="true">
          ViPN
        </div>

        <div className="footer-bottom">
          <span>{s.footer.rights}</span>
          <span>{s.footer.locations}</span>
        </div>

        <p className="footer-legal">
          {company.legalName} · {company.taxStatus} · ИНН {company.inn}
        </p>
      </div>
    </footer>
  );
}
