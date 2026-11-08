import { useI18n } from "../i18n";

export function Steps() {
  const { s } = useI18n();

  return (
    <section className="band rail">
      <div className="wrap">
        <div className="section-head">
          <h2>{s.steps.title}</h2>
          <p className="section-lede">{s.steps.lede}</p>
        </div>
        <div className="steps">
          {s.steps.items.map((item, index) => (
            <article className="step" key={item.title}>
              <div className="step-num">{String(index + 1).padStart(2, "0")}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
