import type { TablerIcon } from "@tabler/icons-react";
import {
  IconArrowDown,
  IconArrowRight,
  IconBolt,
  IconBrandAndroid,
  IconBrandTelegram,
  IconBrandWindows,
  IconCheck,
  IconChevronRight,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDevices,
  IconDownload,
  IconHome,
  IconLink,
  IconLock,
  IconMenu2,
  IconPower,
  IconRefresh,
  IconServer2,
  IconSettings,
  IconShieldCheck,
  IconTerminal2,
  IconWorld,
  IconX,
} from "@tabler/icons-react";

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

const icons: Record<IconName, TablerIcon> = {
  arrow: IconArrowRight,
  arrowDown: IconArrowDown,
  check: IconCheck,
  shield: IconShieldCheck,
  bolt: IconBolt,
  devices: IconDevices,
  link: IconLink,
  power: IconPower,
  chevron: IconChevronRight,
  menu: IconMenu2,
  close: IconX,
  download: IconDownload,
  refresh: IconRefresh,
  terminal: IconTerminal2,
  windows: IconBrandWindows,
  android: IconBrandAndroid,
  phone: IconDeviceMobile,
  laptop: IconDeviceLaptop,
  tablet: IconDeviceTablet,
  lock: IconLock,
  globe: IconWorld,
  gear: IconSettings,
  home: IconHome,
  server: IconServer2,
  telegram: IconBrandTelegram,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Component = icons[name];
  return (
    <Component
      className={className ? `icon ${className}` : "icon"}
      size={16}
      stroke={1.6}
      aria-hidden="true"
      focusable="false"
    />
  );
}
