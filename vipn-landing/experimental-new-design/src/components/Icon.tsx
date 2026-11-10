import type { ReactNode } from "react";

export type IconName =
  | "arrow"
  | "arrowDown"
  | "check"
  | "shield"
  | "bolt"
  | "devices"
  | "link"
  | "power"
  | "chevron"
  | "menu"
  | "close"
  | "download"
  | "refresh"
  | "terminal"
  | "windows"
  | "android"
  | "phone"
  | "laptop"
  | "tablet"
  | "lock"
  | "globe"
  | "gear"
  | "home"
  | "server"
  | "telegram";

const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h13M12 6l6 6-6 6" />,
  arrowDown: <path d="M12 4v14M6 12l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  shield: (
    <>
      <path d="M12 3l7 2.8v5.7c0 4.4-2.9 7.4-7 9.5-4.1-2.1-7-5.1-7-9.5V5.8L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  bolt: <path d="M13 2L5 14h5.5L11 22l8-12h-5.5L13 2z" />,
  devices: (
    <>
      <rect x="2.5" y="4.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 16.5h8M6 13.5v3" />
      <rect x="16" y="8.5" width="5.5" height="11" rx="1.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4 4 0 005.6 0l3-3A4 4 0 0013 4.9l-1.4 1.4" />
      <path d="M14 10.5a4 4 0 00-5.6 0l-3 3A4 4 0 0011 19.1l1.4-1.4" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v8" />
      <path d="M6.2 7.4a7.5 7.5 0 1011.6 0" />
    </>
  ),
  chevron: <path d="M9 5.5l6.5 6.5L9 18.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  download: <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4.5 20h15" />,
  refresh: (
    <>
      <path d="M20 11.5a8 8 0 10-2.4 5.7" />
      <path d="M20 4.5v7h-7" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </>
  ),
  windows: (
    <>
      <path d="M4 5.5h7v6H4zM13 5.5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z" />
    </>
  ),
  android: (
    <>
      <path d="M8 10h8a1 1 0 011 1v7a1 1 0 01-1 1H8a1 1 0 01-1-1v-7a1 1 0 011-1z" />
      <path d="M9.5 10L8 6.5M14.5 10L16 6.5M4.5 13.5v3M19.5 13.5v3" />
      <circle cx="10" cy="14.5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14.5" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="5" width="15" height="10" rx="1.5" />
      <path d="M2 18h20" />
    </>
  ),
  tablet: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </>
  ),
  home: <path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4v-9.5z" />,
  server: (
    <>
      <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
      <rect x="3.5" y="14" width="17" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
    </>
  ),
  telegram: (
    <>
      <path d="M21 3.5L3.5 10.3l5.6 2.3L11 19l3.2-4.4 4.4 2 2.4-13.1z" />
      <path d="M9.1 12.6l8.3-6.2-5.2 7.4" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
