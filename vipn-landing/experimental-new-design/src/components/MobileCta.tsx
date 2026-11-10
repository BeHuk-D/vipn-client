import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";

export function MobileCta() {
  const { s } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 720);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="mobile-cta">
      <a className="btn" href="/downloads/">
        {s.actions.download}
        <Icon name="arrow" />
      </a>
    </div>
  );
}
