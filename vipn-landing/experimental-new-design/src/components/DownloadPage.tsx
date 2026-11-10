import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { Lang } from "../i18n";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Icon } from "./Icon";
import { SectionHead } from "./SectionHead";
import type { IconName } from "./Icon";

type ReleaseAsset = {
  name: string;
  size: number;
  platform: string;
  arch: string;
  kind: string;
  url: string;
};

type ReleaseManifest = {
  tag: string;
  version: string;
  published_at: string;
  assets: ReleaseAsset[];
};

const TELEGRAM_URL = "https://t.me/BeHukD";

const PLATFORM_META: Record<string, { label: string; icon: IconName }> = {
  linux: { label: "Linux", icon: "terminal" },
  windows: { label: "Windows", icon: "windows" },
  android: { label: "Android", icon: "android" },
};

const PLATFORM_ORDER = ["linux", "windows", "android"];

function isManifest(value: unknown): value is ReleaseManifest {
  if (!value || typeof value !== "object") return false;
  const data = value as ReleaseManifest;
  return (
    typeof data.version === "string" &&
    Array.isArray(data.assets) &&
    data.assets.length > 0 &&
    data.assets.every((asset) => typeof asset?.url === "string" && asset.url.startsWith("/downloads/"))
  );
}

function isRecommended(asset: ReleaseAsset): boolean {
  if (asset.platform === "linux") return asset.arch === "x64";
  if (asset.platform === "windows") return asset.name.endsWith(".exe");
  if (asset.platform === "android") return asset.arch === "arm64-v8a";
  return false;
}

function formatDate(value: string, lang: Lang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CopyButton({ text }: { text: string }) {
  const { s } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" className="copy-btn" onClick={copy}>
      <span aria-live="polite">{copied ? s.download.copied : s.download.copy}</span>
    </button>
  );
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function DownloadPage() {
  const { s, lang } = useI18n();
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);

  useEffect(() => {
    document.title = s.meta.downloadTitle;
  }, [s]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/downloads/releases.json", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("no manifest"))))
      .then((data) => {
        if (isManifest(data)) setManifest(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    if (!manifest) return [];
    const map = new Map<string, ReleaseAsset[]>();
    for (const asset of manifest.assets) {
      const key = PLATFORM_META[asset.platform] ? asset.platform : "other";
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => {
        const left = PLATFORM_ORDER.indexOf(a[0]);
        const right = PLATFORM_ORDER.indexOf(b[0]);
        return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
      })
      .map(([key, assets]) => ({
        key,
        label: PLATFORM_META[key]?.label ?? "Other",
        icon: PLATFORM_META[key]?.icon ?? "download",
        assets,
      }));
  }, [manifest]);

  const published = manifest ? formatDate(manifest.published_at, lang) : "";
  const noteFor = (os: string) =>
    s.download.osNotes[os as keyof typeof s.download.osNotes] ?? null;

  return (
    <>
      <Header />
      <main id="main">
        <section className="page-hero">
          <div className="shell">
            <a className="back-link" href="/">
              <Icon name="arrow" className="is-flipped" />
              {s.download.back}
            </a>
            <div className="page-hero-grid">
              <div className="page-hero-copy">
                <p className="eyebrow">
                  <span className="eyebrow-index">04</span>
                  {s.download.eyebrow}
                </p>
                <h1>{s.download.title}</h1>
                <p className="page-lede">{s.download.pageLede}</p>
              </div>

              <aside className="version-card" data-reveal>
                <p className="version-state">
                  <span className="live-dot" />
                  {s.download.latest}
                </p>
                <p className={manifest ? "version-number" : "version-number is-placeholder"}>
                  {manifest?.version ?? "—"}
                </p>
                <div className="version-rows">
                  <div className="version-row">
                    <span>{s.download.published}</span>
                    <span>{published || "—"}</span>
                  </div>
                  <div className="version-row">
                    <span>{s.download.assetsLabel}</span>
                    <span>{manifest ? manifest.assets.length : s.download.targets.length}</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="band band-assets">
          <div className="shell">
            <div className="assets-bar" data-reveal>
              <span>{s.download.assetsLabel}</span>
              <span>{manifest?.tag ?? s.download.latest}</span>
            </div>

            <div className="os-grid">
              {manifest
                ? groups.map((group, index) => (
                    <article
                      className="os-card"
                      key={group.key}
                      data-reveal
                      style={{ transitionDelay: `${index * 60}ms` }}
                    >
                      <div className="os-head">
                        <span className="os-icon">
                          <Icon name={group.icon} />
                        </span>
                        <h2>{group.label}</h2>
                        <span className="os-count">{String(group.assets.length).padStart(2, "0")}</span>
                      </div>
                      <div className="asset-list">
                        {group.assets.map((asset) => (
                          <a className="asset" href={asset.url} download key={asset.name}>
                            <span className="asset-main">
                              <span className="asset-name" title={asset.name}>
                                {asset.name}
                              </span>
                              <span className="asset-sub">
                                {asset.arch} · {Math.round(asset.size / (1024 * 1024))} {s.download.sizeUnit}
                              </span>
                            </span>
                            {isRecommended(asset) ? (
                              <span className="asset-badge">{s.download.recommended}</span>
                            ) : null}
                            <span className="asset-dl">
                              <Icon name="download" />
                            </span>
                          </a>
                        ))}
                      </div>
                      <p className="os-note">{noteFor(group.label)}</p>
                    </article>
                  ))
                : s.download.targets.map((target, index) => (
                    <article
                      className="os-card"
                      key={target.os}
                      data-reveal
                      style={{ transitionDelay: `${index * 60}ms` }}
                    >
                      <div className="os-head">
                        <span className="os-icon">
                          <Icon name={PLATFORM_META[target.os.toLowerCase()]?.icon ?? "download"} />
                        </span>
                        <h2>{target.os}</h2>
                        <span className="os-count">01</span>
                      </div>
                      <div className="asset-list">
                        <a
                          className="asset"
                          href={TELEGRAM_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="asset-main">
                            <span className="asset-name">{target.files}</span>
                            <span className="asset-sub">{s.download.pending}</span>
                          </span>
                          <span className="asset-dl">
                            <Icon name="arrow" />
                          </span>
                        </a>
                      </div>
                      <p className="os-note">{noteFor(target.os)}</p>
                    </article>
                  ))}
            </div>

            {!manifest ? <p className="empty-note">{s.download.noManifest}</p> : null}
          </div>
        </section>

        <section className="band">
          <div className="shell">
            <SectionHead
              index="05"
              eyebrow={s.nav.how}
              title={s.download.installTitle}
              lede={s.download.installLede}
            />

            <div className="guides">
              {s.download.guides.map((guide, index) => (
                <article
                  className="guide"
                  key={guide.os}
                  data-reveal
                  style={{ transitionDelay: `${index * 60}ms` }}
                >
                  <div className="guide-head">
                    <span className="guide-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="guide-icon">
                      <Icon name={PLATFORM_META[guide.os.toLowerCase()]?.icon ?? "terminal"} />
                    </span>
                    <h3>{guide.os}</h3>
                  </div>
                  <p>{guide.text}</p>
                  {guide.code ? (
                    <div className="code-block">
                      <pre>
                        <code>{guide.code}</code>
                      </pre>
                      <CopyButton text={guide.code} />
                    </div>
                  ) : guide.file ? (
                    <div className="guide-file">
                      <Icon name="download" />
                      <span>{guide.file}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="page-note" data-reveal>
              <p>{s.download.fallback}</p>
              <div className="page-note-actions">
                <a className="btn btn-sm" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
                  Telegram
                  <Icon name="telegram" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
