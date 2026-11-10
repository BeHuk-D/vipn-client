import appScreen from "../assets/app-screen.png";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";

export function PhoneMockup() {
  const { s } = useI18n();

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

      <div className="chip chip-secure" aria-hidden="true">
        <Icon name="shield" />
        <span>{s.mock.secure}</span>
      </div>
    </div>
  );
}
