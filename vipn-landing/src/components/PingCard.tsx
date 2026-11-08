import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

const PING_URL = "https://217.60.94.172/ping";
const SAMPLES = 3;
const TIMEOUT_MS = 6000;

type State = "idle" | "measuring" | "error";

async function probe(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(`${PING_URL}?t=${Date.now()}-${Math.random()}`, {
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ping failed: ${response.status}`);
    return performance.now() - started;
  } finally {
    clearTimeout(timer);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function PingCard() {
  const { s } = useI18n();
  const [state, setState] = useState<State>("idle");
  const [value, setValue] = useState<number | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  const measure = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setState("measuring");
    setValue(null);

    try {
      await probe();
      const samples: number[] = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        samples.push(await probe());
      }
      if (!mounted.current) return;
      setValue(Math.round(median(samples)));
      setState("idle");
    } catch {
      if (mounted.current) setState("error");
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      void measure();
    }, 700);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [measure]);

  const measuring = state === "measuring";
  const buttonLabel = measuring ? s.ping.measuring : value === null ? s.ping.measure : s.ping.again;
  const announcement =
    value !== null
      ? `${value} ${s.ping.unit}`
      : measuring
        ? s.ping.measuring
        : state === "error"
          ? s.ping.error
          : "";

  return (
    <div className="ping-plate">
      <p className="ping-title">{s.ping.title}</p>
      <p className="ping-value" aria-hidden="true">
        {value !== null ? (
          <span>{value}</span>
        ) : (
          <span className="ping-placeholder">{measuring ? "…" : "—"}</span>
        )}
        <span className="ping-unit">{s.ping.unit}</span>
      </p>
      <p className="ping-place">{s.ping.place}</p>
      {state === "error" && <p className="ping-error">{s.ping.error}</p>}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <button
        className="btn btn-ghost ping-button"
        type="button"
        onClick={measure}
        disabled={measuring}
      >
        {buttonLabel}
      </button>
      <p className="ping-note">{s.ping.note}</p>
    </div>
  );
}
