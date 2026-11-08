import { useI18n } from "../i18n";
import { REPO_URL } from "../links";
import { Crown } from "./Crown";

export function Footer() {
  const { s } = useI18n();

  return (
    <footer className="site-foot rail">
      <div className="wrap foot">
        <span className="foot-brand">
          <Crown />
          ViPN
        </span>
        <span>{s.footer.tagline}</span>
        <a href={REPO_URL} target="_blank" rel="noopener">
          GitHub
        </a>
      </div>
    </footer>
  );
}
