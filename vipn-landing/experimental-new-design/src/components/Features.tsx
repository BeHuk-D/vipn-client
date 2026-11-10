import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { SectionHead } from "./SectionHead";

export function Features() {
  const { s } = useI18n();
  const [unblocks, devices, speed, privacy] = s.features.items;

  return (
    <section className="band" id="features">
      <div className="shell">
        <SectionHead index="01" eyebrow={s.features.eyebrow} title={s.features.title} lede={s.features.lede} />

        <div className="bento">
          <article className="bento-card bento-dark bento-a" data-reveal>
            <div className="card-head">
              <span className="card-index">01</span>
              <span className="card-icon">
                <Icon name="shield" />
              </span>
            </div>
            <h3>{unblocks.title}</h3>
            <p>{unblocks.text}</p>
            <div className="service-cloud" aria-hidden="true">
              {s.ticker.items.slice(0, 6).map((item) => (
                <span className="service" key={item}>
                  <Icon name="check" />
                  {item}
                </span>
              ))}
            </div>
            <p className="mono-note">{s.features.protocolNote}</p>
          </article>

          <article className="bento-card bento-b" data-reveal style={{ transitionDelay: "60ms" }}>
            <div className="card-head">
              <span className="card-index">02</span>
              <span className="card-icon">
                <Icon name="bolt" />
              </span>
            </div>
            <h3>{speed.title}</h3>
            <p>{speed.text}</p>
            <div className="speed" aria-hidden="true">
              <div className="speed-head">
                <span className="speed-value">{s.features.speedValue}</span>
                <span className="speed-unit">{s.features.speedUnit}</span>
              </div>
              <svg className="spark" viewBox="0 0 240 64" preserveAspectRatio="none">
                <path
                  className="spark-area"
                  d="M0 54 L18 50 L36 52 L54 42 L72 46 L90 34 L108 38 L126 27 L144 31 L162 20 L180 24 L198 13 L216 17 L240 8 L240 64 L0 64 Z"
                />
                <path
                  className="spark-line"
                  d="M0 54 L18 50 L36 52 L54 42 L72 46 L90 34 L108 38 L126 27 L144 31 L162 20 L180 24 L198 13 L216 17 L240 8"
                />
              </svg>
              <span className="speed-label">{s.features.speedLabel}</span>
            </div>
          </article>

          <article className="bento-card bento-c" data-reveal style={{ transitionDelay: "90ms" }}>
            <div className="card-head">
              <span className="card-index">03</span>
              <span className="card-icon">
                <Icon name="devices" />
              </span>
            </div>
            <h3>{devices.title}</h3>
            <p>{devices.text}</p>
            <div className="device-row" aria-hidden="true">
              <span className="device-icon">
                <Icon name="phone" />
              </span>
              <span className="device-icon">
                <Icon name="laptop" />
              </span>
              <span className="device-icon">
                <Icon name="tablet" />
              </span>
              <span className="device-badge">{s.features.devicesLabel}</span>
            </div>
          </article>

          <article className="bento-card bento-d" data-reveal style={{ transitionDelay: "120ms" }}>
            <div className="card-head">
              <span className="card-index">04</span>
              <span className="card-icon">
                <Icon name="link" />
              </span>
            </div>
            <div className="bento-split">
              <div>
                <h3>{privacy.title}</h3>
                <p>{privacy.text}</p>
              </div>
              <div className="link-card" aria-hidden="true">
                <span className="link-card-label">{s.features.linkLabel}</span>
                <div className="link-field">
                  <Icon name="link" />
                  <span className="link-value">{s.features.linkValue}</span>
                  <span className="link-ok">
                    <Icon name="check" />
                  </span>
                </div>
                <span className="link-hint">{s.features.protocolNote}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
