import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import type { Lang } from "../i18n";
import { RELEASE_URL } from "../links";
import { Footer } from "./Footer";
import { Header } from "./Header";

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

const PLATFORM_LABELS: Record<string, string> = {
  linux: "Linux",
  windows: "Windows",
  android: "Android",
};

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

function assetLabel(asset: ReleaseAsset): string {
  const os = PLATFORM_LABELS[asset.platform] ?? asset.platform;
  return asset.name.endsWith(".msi") ? `${os} ${asset.arch} MSI` : `${os} ${asset.arch}`;
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
  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function DownloadPage() {
  const { s, lang } = useI18n();
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);

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

  return (
    <>
      <Header />
      <main id="top">
        <section className="band rail">
          <div className="wrap">
            <div className="section-head">
              <h2>{s.download.title}</h2>
              <p className="section-lede">{s.download.pageLede}</p>
            </div>
            {manifest ? (
              <p className="download-version">
                {s.download.version} {manifest.version}
                {formatDate(manifest.published_at, lang)
                  ? ` · ${formatDate(manifest.published_at, lang)}`
                  : ""}
              </p>
            ) : null}
            <div className="downloads">
              {manifest
                ? manifest.assets.map((asset) => (
                    <a className="download-row" href={asset.url} download key={asset.name}>
                      <span className="os">{assetLabel(asset)}</span>
                      <span className="files">
                        {asset.name}
                        <span className="file-size">
                          {Math.round(asset.size / (1024 * 1024))} {s.download.sizeUnit}
                        </span>
                      </span>
                      {isRecommended(asset) ? (
                        <span className="download-badge">{s.download.recommended}</span>
                      ) : null}
                      <span className="arrow" aria-hidden="true">
                        ↓
                      </span>
                    </a>
                  ))
                : s.download.targets.map((target) => (
                    <a
                      className="download-row"
                      href={RELEASE_URL}
                      target="_blank"
                      rel="noopener"
                      key={target.os}
                    >
                      <span className="os">{target.os}</span>
                      <span className="files">{target.files}</span>
                      <span className="arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  ))}
            </div>
            <div className="download-actions">
              <span className="download-hint">{s.download.hint}</span>
            </div>
          </div>
        </section>

        <section className="band rail">
          <div className="wrap">
            <div className="section-head">
              <h2>{s.download.installTitle}</h2>
              <p className="section-lede">{s.download.installLede}</p>
            </div>
            <div className="guides">
              {s.download.guides.map((guide) => (
                <article className="guide" key={guide.os}>
                  <h3>{guide.os}</h3>
                  <p>{guide.text}</p>
                  {guide.code ? <code>{guide.code}</code> : null}
                </article>
              ))}
            </div>
            <p className="plan-note">
              <span>{s.download.fallback}</span>{" "}
              <a href={RELEASE_URL} target="_blank" rel="noopener">
                {s.actions.release}
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
