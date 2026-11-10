import appScreen from "../assets/app-screen.png";
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
        DE · NL
      </span>

      <div className="phone" aria-hidden="true">
        <div className="phone-screen">
          <img
            className="app-screen"
            src={appScreen}
            alt=""
            width={374}
            height={687}
            decoding="async"
          />
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
