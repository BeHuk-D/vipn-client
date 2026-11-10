import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const OS_ICONS: Record<string, IconName> = {
  Linux: "terminal",
  Windows: "windows",
  Android: "android",
};

export function Download() {
  const { s } = useI18n();

  return (
    <section className="band band-download" id="download">
      <div className="shell">
        <div className="dl-panel" data-reveal>
          <div className="dl-copy">
            <p className="eyebrow">{s.download.eyebrow}</p>
            <h2>{s.download.panelTitle}</h2>
            <p className="dl-lede">{s.download.panelLede}</p>
            <a className="btn btn-inverse" href="/downloads/">
              {s.actions.download}
              <Icon name="arrow" />
            </a>
            <p className="dl-note">
              <Icon name="shield" />
              {s.download.note}
            </p>
          </div>

          <div className="dl-os">
            {s.download.targets.map((target) => (
              <a className="dl-os-row" href="/downloads/" key={target.os}>
                <span className="dl-os-icon">
                  <Icon name={OS_ICONS[target.os] ?? "download"} />
                </span>
                <span className="dl-os-copy">
                  <strong>{target.os}</strong>
                  <small>{target.files}</small>
                </span>
                <span className="dl-os-arrow">
                  <Icon name="download" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
