import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { SectionHead } from "./SectionHead";
import type { IconName } from "./Icon";

const TELEGRAM_URL = "https://t.me/BeHukD";
const STEP_ICONS: IconName[] = ["link", "download", "power"];

export function Steps() {
  const { s } = useI18n();

  return (
    <section className="steps-band" id="how">
      <div className="shell">
        <SectionHead index="02" eyebrow={s.steps.eyebrow} title={s.steps.title} lede={s.steps.lede} />

        <ol className="steps">
          {s.steps.items.map((item, index) => (
            <li className="step" key={item.title} data-reveal style={{ transitionDelay: `${index * 70}ms` }}>
              <div className="step-top">
                <span className="step-no">{String(index + 1).padStart(2, "0")}</span>
                <span className="step-icon">
                  <Icon name={STEP_ICONS[index] ?? "power"} />
                </span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>

        <div className="steps-foot" data-reveal>
          <p>{s.steps.note}</p>
          <a className="btn btn-inverse btn-sm" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            {s.actions.telegram}
            <Icon name="telegram" />
          </a>
        </div>
      </div>
    </section>
  );
}
