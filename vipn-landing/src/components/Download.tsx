import { useI18n } from "../i18n";

export function Download() {
  const { s } = useI18n();

  return (
    <section className="band rail" id="download">
      <div className="wrap">
        <div className="section-head">
          <h2>{s.download.title}</h2>
          <p className="section-lede">{s.download.teaserLede}</p>
        </div>
        <a className="btn btn-primary btn-block" href="/downloads/">
          {s.actions.download}
        </a>
      </div>
    </section>
  );
}
