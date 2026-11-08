import { useI18n } from "../i18n";
import { PingCard } from "./PingCard";

export function Hero() {
  const { s } = useI18n();

  return (
    <section className="hero-band rail">
      <div className="wrap hero">
        <div>
          <h1>{s.hero.title}</h1>
          <p className="lede">{s.hero.lede}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/downloads/">
              {s.actions.download}
            </a>
            <a className="btn btn-ghost" href="#pricing">
              {s.actions.pricing}
            </a>
          </div>
          <ul className="specs">
            {s.hero.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </div>
        <PingCard />
      </div>
    </section>
  );
}
