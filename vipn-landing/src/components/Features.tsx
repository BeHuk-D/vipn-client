import { useI18n } from "../i18n";

export function Features() {
  const { s } = useI18n();

  return (
    <section className="band rail" id="features">
      <div className="wrap">
        <div className="section-head">
          <h2>{s.features.title}</h2>
          <p className="section-lede">{s.features.lede}</p>
        </div>
        <div className="features">
          {s.features.items.map((item) => (
            <article className="feature" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
