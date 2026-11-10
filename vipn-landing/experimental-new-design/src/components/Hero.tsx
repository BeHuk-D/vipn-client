import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { PhoneMockup } from "./PhoneMockup";
import { Stats } from "./Stats";

export function Hero() {
  const { s } = useI18n();

  return (
    <section className="hero" id="top">
      <div className="hero-grid shell">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span className="live-dot" />
            {s.hero.eyebrow}
          </p>
          <h1 aria-label={s.hero.title.join(" ")}>
            {s.hero.title.map((line, index) => (
              <span
                className={index === s.hero.title.length - 1 ? "hero-line is-outline" : "hero-line"}
                key={line}
              >
                {line}
              </span>
            ))}
          </h1>
          <p className="hero-lede">{s.hero.lede}</p>
          <div className="hero-actions">
            <a className="btn btn-lg" href="/downloads/">
              {s.actions.download}
              <Icon name="arrow" />
            </a>
            <a className="btn btn-ghost btn-lg" href="#pricing">
              {s.actions.pricing}
            </a>
          </div>
          <p className="hero-note">
            <Icon name="check" />
            {s.hero.note}
          </p>
        </div>

        <div className="hero-visual" data-reveal>
          <PhoneMockup />
        </div>
      </div>
      <Stats />
    </section>
  );
}
