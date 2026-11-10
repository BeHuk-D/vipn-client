import { useI18n } from "../i18n";

export function Stats() {
  const { s } = useI18n();

  return (
    <div className="stats">
      <div className="shell stats-grid">
        {s.stats.items.map((item) => (
          <div className="stat" key={item.label}>
            <span className="stat-value">{item.value}</span>
            <span className="stat-label">{item.label}</span>
            <span className="stat-sub">{item.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TICKER_REPEATS = 6;

export function Ticker() {
  const { s } = useI18n();
  const items = Array.from({ length: TICKER_REPEATS }, () => s.ticker.items).flat();

  return (
    <section className="ticker" aria-label={s.ticker.label}>
      <span className="ticker-label">{s.ticker.label}</span>
      <div className="ticker-viewport">
        <div className="ticker-track">
          <ul className="ticker-list">
            {items.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
          <ul className="ticker-list" aria-hidden="true">
            {items.map((item, index) => (
              <li key={`${item}-copy-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
