import { useI18n } from "../i18n";
import { usePing } from "../usePing";
import { Icon } from "./Icon";

export function PhoneMockup() {
  const { s } = useI18n();
  const { state, value, measure } = usePing();
  const measuring = state === "measuring";
  const buttonLabel = measuring ? s.ping.measuring : value !== null ? s.ping.again : s.ping.measure;
  const displayValue = value !== null ? value : measuring ? "…" : "—";
  const announcement =
    state === "error"
      ? s.ping.error
      : value !== null
        ? `${value} ${s.ping.unit}`
        : measuring
          ? s.ping.measuring
          : "";

  return (
    <div className="stage">
      <div className="orbit orbit-a" aria-hidden="true" />
      <div className="orbit orbit-b" aria-hidden="true" />
      <span className="stage-tag" aria-hidden="true">
        AMNEZIAWG 3.1
      </span>

      <div className="phone" aria-hidden="true">
        <div className="phone-screen">
          <div className="phone-status">
            <span>9:41</span>
            <span className="phone-status-icons">
              <span className="status-bars">
                <i />
                <i />
                <i />
              </span>
              100%
            </span>
          </div>

          <div className="app-head">
            <span className="app-brand">ViPN</span>
            <Icon name="gear" className="app-gear" />
          </div>

          <p className="app-caption">{s.mock.status}</p>

          <div className="connect">
            <svg className="connect-svg" viewBox="0 0 220 220">
              <circle className="connect-track" cx="110" cy="110" r="104" />
              <circle className="connect-arc" cx="110" cy="110" r="104" />
              <circle className="connect-dashes" cx="110" cy="110" r="93" />
            </svg>
            <span className="connect-core">
              <Icon name="power" />
            </span>
          </div>
          <p className="app-state">{s.mock.connected}</p>

          <div className="app-server">
            <span className="app-flag">DE</span>
            <span className="app-server-copy">
              <strong>{s.mock.server}</strong>
              <small>
                {displayValue} {s.ping.unit} · {s.mock.protocol}
              </small>
            </span>
            <Icon name="chevron" className="app-chevron" />
          </div>

          <div className="app-traffic">
            <div className="app-traffic-cell">
              <span>{s.mock.download}</span>
              <strong>{s.mock.downloadValue}</strong>
            </div>
            <div className="app-traffic-cell">
              <span>{s.mock.upload}</span>
              <strong>{s.mock.uploadValue}</strong>
            </div>
            <svg className="app-spark" viewBox="0 0 120 34" preserveAspectRatio="none">
              <path d="M0 29 L10 26 L20 27 L30 19 L40 22 L50 14 L60 17 L70 10 L80 13 L90 7 L100 10 L110 5 L120 8" />
            </svg>
          </div>

          <div className="app-sub">
            <span className="app-sub-label">{s.mock.subscription}</span>
            <span className="app-sub-date">{s.mock.until}</span>
            <span className="app-sub-badge">{s.mock.active}</span>
          </div>

          <div className="app-tabs">
            <Icon name="home" className="is-active" />
            <Icon name="server" />
            <Icon name="gear" />
          </div>
        </div>
      </div>

      <div className="chip chip-ping">
        <span className="chip-label">
          <span className="live-dot" />
          {s.ping.label}
        </span>
        <span className="chip-value">
          {displayValue}
          <em>{s.ping.unit}</em>
        </span>
        {state === "error" ? <span className="chip-error">{s.ping.error}</span> : null}
        <button className="chip-btn" type="button" onClick={measure} disabled={measuring}>
          {buttonLabel}
          <Icon name="refresh" className={measuring ? "is-spinning" : undefined} />
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </div>

      <div className="chip chip-secure" aria-hidden="true">
        <Icon name="shield" />
        <span>{s.mock.secure}</span>
      </div>
    </div>
  );
}
