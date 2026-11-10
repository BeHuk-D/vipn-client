import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { SectionHead } from "./SectionHead";

const TELEGRAM_URL = "https://t.me/BeHukD";

export function Pricing() {
  const { s } = useI18n();

  return (
    <section className="band" id="pricing">
      <div className="shell">
        <SectionHead index="03" eyebrow={s.pricing.eyebrow} title={s.pricing.title} lede={s.pricing.lede} />

        <div className="plans">
          {s.pricing.plans.map((plan, index) => {
            const featured = index === s.pricing.plans.length - 1;
            return (
              <article
                className={featured ? "plan is-featured" : "plan"}
                key={plan.name}
                data-reveal
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <div className="plan-top">
                  <span className="plan-name">{plan.name}</span>
                  {featured ? <span className="plan-badge">{s.pricing.badge}</span> : null}
                </div>
                <p className="plan-price">
                  <span className="amount">{plan.price}</span>
                  <small>{plan.period}</small>
                </p>
                <p className="plan-devices">{plan.devices}</p>
                <ul className="plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="check" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  className={featured ? "btn btn-inverse plan-buy" : "btn btn-ghost plan-buy"}
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.actions.buy}
                  <Icon name="arrow" />
                </a>
              </article>
            );
          })}
        </div>

        <div className="pricing-foot" data-reveal>
          <ul className="assurances">
            {s.pricing.assurances.map((item) => (
              <li key={item}>
                <Icon name="check" />
                {item}
              </li>
            ))}
          </ul>
          <p className="plan-note">
            {s.pricing.note}{" "}
            <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
              @BeHukD
            </a>
            {s.pricing.noteTail}{" "}
            <a href="/downloads/">{s.pricing.noteDownload} →</a>
          </p>
        </div>
      </div>
    </section>
  );
}
