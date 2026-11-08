import { useI18n } from "../i18n";

const TELEGRAM_URL = "https://t.me/BeHukD";

export function Pricing() {
  const { s } = useI18n();

  return (
    <section className="band rail" id="pricing">
      <div className="wrap">
        <div className="section-head">
          <h2>{s.pricing.title}</h2>
          <p className="section-lede">{s.pricing.lede}</p>
        </div>
        <div className="plans">
          {s.pricing.plans.map((plan) => (
            <article className="plan" key={plan.name}>
              <p className="plan-name">{plan.name}</p>
              <p className="price">
                <span>{plan.price}</span>
                <small>{plan.period}</small>
              </p>
              <p className="plan-devices">{plan.devices}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a
                className="btn btn-ghost btn-small plan-buy"
                href={TELEGRAM_URL}
                target="_blank"
                rel="noreferrer"
              >
                {s.actions.buy}
              </a>
            </article>
          ))}
        </div>
        <p className="plan-note">
          <span>{s.pricing.note}</span>{" "}
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            @BeHukD
          </a>
          <span>{s.pricing.noteTail}</span>{" "}
          <a href="/downloads/">{s.pricing.noteDownload} →</a>
        </p>
      </div>
    </section>
  );
}
