import { useCallback, useEffect, useRef, useState } from "react";

const PING_URL = "https://217.60.94.172/ping";
const SAMPLES = 3;
const TIMEOUT_MS = 6000;

export type PingState = "idle" | "measuring" | "error";

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

export function usePing() {
  const [state, setState] = useState<PingState>("idle");
  const [value, setValue] = useState<number | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  const measure = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setState("measuring");

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
    }, 900);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [measure]);

  return { state, value, measure };
}
