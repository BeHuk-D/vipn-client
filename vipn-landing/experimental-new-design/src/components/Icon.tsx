import type { TablerIcon } from "@tabler/icons-react";
import {
  IconArrowRight,
  IconBolt,
  IconBrandAndroid,
  IconBrandTelegram,
  IconBrandWindows,
  IconCheck,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDevices,
  IconDownload,
  IconLink,
  IconMenu2,
  IconPower,
  IconShieldCheck,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";

export type IconName =
  | "arrow"
  | "check"
  | "shield"
  | "bolt"
  | "devices"
  | "link"
  | "power"
  | "menu"
  | "close"
  | "download"
  | "terminal"
  | "windows"
  | "android"
  | "phone"
  | "laptop"
  | "tablet"
  | "telegram";

const icons: Record<IconName, TablerIcon> = {
  arrow: IconArrowRight,
  check: IconCheck,
  shield: IconShieldCheck,
  bolt: IconBolt,
  devices: IconDevices,
  link: IconLink,
  power: IconPower,
  menu: IconMenu2,
  close: IconX,
  download: IconDownload,
  terminal: IconTerminal2,
  windows: IconBrandWindows,
  android: IconBrandAndroid,
  phone: IconDeviceMobile,
  laptop: IconDeviceLaptop,
  tablet: IconDeviceTablet,
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
