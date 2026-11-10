import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "ru" | "en";

type Feature = { title: string; text: string };
type Step = { title: string; text: string };
type Plan = { name: string; price: string; period: string; devices: string; features: string[] };
type Target = { os: string; files: string };
type Guide = { os: string; text: string; code?: string; file?: string };

export type Strings = {
  navLabel: string;
  langLabel: string;
  meta: { homeTitle: string; downloadTitle: string };
  nav: { features: string; how: string; pricing: string; download: string };
  actions: {
    download: string;
    pricing: string;
    login: string;
    buy: string;
    choose: string;
    backHome: string;
    telegram: string;
  };
  header: { menu: string; close: string };
  hero: { eyebrow: string; title: string[]; lede: string; note: string };
  mock: {
    secure: string;
  };
  ping: {
    label: string;
    unit: string;
    measure: string;
    measuring: string;
    again: string;
    error: string;
  };
  ticker: { label: string; items: string[] };
  stats: { items: { value: string; label: string; sub: string }[] };
  features: {
    eyebrow: string;
    title: string;
    lede: string;
    items: Feature[];
    speedLabel: string;
    speedValue: string;
    speedUnit: string;
    linkLabel: string;
    linkValue: string;
    devicesLabel: string;
    protocolNote: string;
  };
  steps: { eyebrow: string; title: string; lede: string; items: Step[]; note: string };
  pricing: {
    eyebrow: string;
    title: string;
    lede: string;
    badge: string;
    plans: Plan[];
    note: string;
    noteTail: string;
    noteDownload: string;
    assurances: string[];
  };
  download: {
    eyebrow: string;
    title: string;
    lede: string;
    panelTitle: string;
    panelLede: string;
    note: string;
    pageLede: string;
    version: string;
    published: string;
    latest: string;
    sizeUnit: string;
    recommended: string;
    assetsLabel: string;
    installTitle: string;
    installLede: string;
    targets: Target[];
    guides: Guide[];
    fallback: string;
    copy: string;
    copied: string;
    back: string;
    noManifest: string;
    pending: string;
    osNotes: { Linux: string; Windows: string; Android: string };
  };
  footer: { tagline: string; note: string; rights: string; documents: string; locations: string };
};

const unlimitedRu = "Безлимитный трафик";
const unlimitedEn = "Unlimited traffic";

export const strings: Record<Lang, Strings> = {
  ru: {
    navLabel: "Разделы",
    langLabel: "Язык",
    meta: {
      homeTitle: "ViPN — VPN, которого не видно",
      downloadTitle: "Скачать клиент — ViPN",
    },
    nav: { features: "Возможности", how: "Как это работает", pricing: "Тарифы", download: "Скачать" },
    actions: {
      download: "Скачать клиент",
      pricing: "Посмотреть тарифы",
      login: "Войти",
      buy: "Купить",
      choose: "Выбрать",
      backHome: "На главную",
      telegram: "Написать в Telegram",
    },
    header: { menu: "Меню", close: "Закрыть" },
    hero: {
      eyebrow: "VPN · Германия · Нидерланды",
      title: ["VPN,", "которого", "не видно."],
      lede: "YouTube, Instagram, Telegram и любимые сериалы снова работают — без тормозов и «недоступно в вашем регионе». Одна подписка на все устройства, подключение за минуту.",
      note: "Без аккаунта и логов. Установка — минута.",
    },
    mock: {
      secure: "Трафик зашифрован",
    },
    ping: {
      label: "Пинг до Германии",
      unit: "мс",
      measure: "Проверить",
      measuring: "Проверяем…",
      again: "Обновить",
      error: "Нет ответа",
    },
    ticker: {
      label: "Снова работает",
      items: [
        "YouTube",
        "Instagram",
        "Telegram",
        "Spotify",
        "Netflix",
        "Discord",
        "ChatGPT",
        "Figma",
        "Steam",
        "Notion",
      ],
    },
    stats: {
      items: [
        { value: "2", label: "локации", sub: "Германия и Нидерланды" },
        { value: "∞", label: "трафик", sub: "Без лимитов и замедлений" },
        { value: "4", label: "устройства", sub: "Телефон, ноутбук, планшет" },
        { value: "<1", label: "минута", sub: "От оплаты до соединения" },
      ],
    },
    features: {
      eyebrow: "Возможности",
      title: "Почему ViPN",
      lede: "Мы убрали всё, что обычно мешает пользоваться VPN: настройки, аккаунты и обрывы. Осталось только то, что работает.",
      items: [
        {
          title: "Открывает заблокированное",
          text: "Зарубежные сервисы, соцсети и рабочие инструменты снова доступны. Соединение не распознаётся фильтрами и не обрывается на ровном месте.",
        },
        {
          title: "Одна подписка — все устройства",
          text: "Телефон, ноутбук, планшет — до 4 устройств одновременно. Вставили ссылку в приложение, и всё уже работает.",
        },
        {
          title: "Скорость без просадок",
          text: "Видео в 4K, звонки и большие загрузки идут стабильно. Трафик безлимитный — смотрите и качайте сколько нужно.",
        },
        {
          title: "Без аккаунта и лишних данных",
          text: "Для подключения нужна только ссылка-подписка. Мы не храним историю посещений и не передаём данные третьим лицам.",
        },
      ],
      speedLabel: "Средняя скорость",
      speedValue: "94.2",
      speedUnit: "Мбит/с",
      linkLabel: "Ссылка-подписка",
      linkValue: "vipn-connect.space/r/8f3k2m",
      devicesLabel: "До 4 устройств",
      protocolNote: "DPI · без обрывов",
    },
    steps: {
      eyebrow: "Как это работает",
      title: "Подключение за минуту",
      lede: "Никаких настроек и инструкций: справится любой.",
      items: [
        {
          title: "Оформите подписку",
          text: "Напишите нам в Telegram — выдадим ссылку-подписку за пару минут.",
        },
        {
          title: "Установите приложение",
          text: "Скачайте ViPN для Windows, Android или Linux и вставьте ссылку на главном экране.",
        },
        {
          title: "Нажмите «Подключиться»",
          text: "Всё готово. Конфиг обновляется сам, когда вы продлеваете подписку.",
        },
      ],
      note: "Нужна только ссылка-подписка — остальное приложение сделает само.",
    },
    pricing: {
      eyebrow: "Тарифы",
      title: "Тарифы",
      lede: "Один платёж — месяц без ограничений. Чем больше устройств, тем выгоднее подписка.",
      badge: "Выбор большинства",
      plans: [
        {
          name: "Старт",
          price: "75",
          period: "₽ / мес",
          devices: "1 устройство",
          features: [unlimitedRu, "Обход блокировок", "Автообновление конфига"],
        },
        {
          name: "Семья",
          price: "120",
          period: "₽ / мес",
          devices: "2 устройства",
          features: [unlimitedRu, "2 устройства одновременно", "Автообновление конфига"],
        },
        {
          name: "Максимум",
          price: "200",
          period: "₽ / мес",
          devices: "4 устройства",
          features: [unlimitedRu, "4 устройства одновременно", "Все локации"],
        },
      ],
      note: "Онлайн-оплата пока не подключена. Напишите в Telegram",
      noteTail: " — оформим подписку и учтём бонусный баланс.",
      noteDownload: "Скачать приложение",
      assurances: ["Оплата в Telegram", "Без автопродления", "Бонусный баланс"],
    },
    download: {
      eyebrow: "Клиенты",
      title: "Скачать клиент",
      lede: "Установка занимает минуту. Приложение бесплатное, а подписка работает сразу после оплаты.",
      panelTitle: "Интернет без границ на каждом устройстве",
      panelLede: "Один установщик, одна ссылка-подписка и одна кнопка «Подключиться».",
      note: "Версия всегда свежая — обновление приходит само.",
      pageLede: "Выберите своё устройство и скачайте приложение. Здесь всегда свежая версия — обновлять вручную не нужно.",
      version: "Версия",
      published: "Опубликовано",
      latest: "Последняя версия",
      sizeUnit: "МБ",
      recommended: "Рекомендуем",
      assetsLabel: "Файлы",
      installTitle: "Как установить",
      installLede: "Справится любой: три шага и никаких настроек.",
      targets: [
        { os: "Linux", files: "ViPN_x.y.z_linux_x64.run" },
        { os: "Windows", files: "ViPN_x.y.z_windows_x64.exe · .msi" },
        { os: "Android", files: "arm64-v8a · armeabi-v7a · x86_64 APK" },
      ],
      guides: [
        {
          os: "Linux",
          text: "Скачайте .run, сделайте файл исполняемым и запустите установщик.",
          code: "chmod +x ViPN_*_linux_x64.run && ./ViPN_*_linux_x64.run",
        },
        {
          os: "Windows",
          text: "Запустите .exe и следуйте мастеру установки. Вариант .msi — для установки через групповые политики или администратора.",
          file: "ViPN_x.y.z_windows_x64.exe",
        },
        {
          os: "Android",
          text: "Откройте скачанный APK и разрешите установку из этого источника. Для большинства телефонов подходит arm64-v8a.",
          file: "ViPN_x.y.z_android_arm64-v8a.apk",
        },
      ],
      fallback: "Не получается скачать? Напишите в Telegram — поможем с установкой.",
      copy: "Скопировать",
      copied: "Скопировано",
      back: "На главную",
      noManifest: "Список файлов обновится в ближайшее время. Пока напишите в Telegram — пришлём установщик.",
      pending: "Напишите в Telegram",
      osNotes: {
        Linux: "Установщик для x64-дистрибутивов",
        Windows: "Windows 10 и 11, x64",
        Android: "APK для телефонов и планшетов",
      },
    },
    footer: {
      tagline: "VPN, которого не видно.",
      note: "Мы не храним историю посещений и не передаём данные третьим лицам.",
      rights: "© 2026 ViPN",
      documents: "Документы",
      locations: "Германия · Нидерланды",
    },
  },
  en: {
    navLabel: "Sections",
    langLabel: "Language",
    meta: {
      homeTitle: "ViPN — A VPN that doesn't look like one",
      downloadTitle: "Download ViPN",
    },
    nav: { features: "Features", how: "How it works", pricing: "Pricing", download: "Download" },
    actions: {
      download: "Get the app",
      pricing: "See pricing",
      login: "Log in",
      buy: "Buy",
      choose: "Choose",
      backHome: "Back home",
      telegram: "Message us on Telegram",
    },
    header: { menu: "Menu", close: "Close" },
    hero: {
      eyebrow: "VPN · Germany · Netherlands",
      title: ["A VPN", "that doesn't", "look like one."],
      lede: "YouTube, Instagram, Telegram and your favourite shows work again — no slowdowns, no “not available in your region”. One subscription for every device, set up in a minute.",
      note: "No account, no logs. Setup takes a minute.",
    },
    mock: {
      secure: "Traffic encrypted",
    },
    ping: {
      label: "Ping to Germany",
      unit: "ms",
      measure: "Check",
      measuring: "Measuring…",
      again: "Refresh",
      error: "No response",
    },
    ticker: {
      label: "Working again",
      items: [
        "YouTube",
        "Instagram",
        "Telegram",
        "Spotify",
        "Netflix",
        "Discord",
        "ChatGPT",
        "Figma",
        "Steam",
        "Notion",
      ],
    },
    stats: {
      items: [
        { value: "2", label: "locations", sub: "Germany and the Netherlands" },
        { value: "∞", label: "traffic", sub: "Unlimited, no throttling" },
        { value: "4", label: "devices", sub: "Phone, laptop, tablet" },
        { value: "<1", label: "minute", sub: "From payment to connection" },
      ],
    },
    features: {
      eyebrow: "Features",
      title: "Why ViPN",
      lede: "We removed everything that usually gets in the way of a VPN: settings, accounts and dropped connections. Only what works is left.",
      items: [
        {
          title: "Unblocks what you need",
          text: "Foreign services, social networks and work tools are available again. The connection is not recognised by filters and does not drop for no reason.",
        },
        {
          title: "One subscription, every device",
          text: "Phone, laptop, tablet — up to 4 devices at once. Paste the link into the app and it just works.",
        },
        {
          title: "Speed that holds up",
          text: "4K video, calls and big downloads stay smooth. Traffic is unlimited, so watch and download as much as you like.",
        },
        {
          title: "No account, no extra data",
          text: "All you need to connect is a subscription link. We do not keep browsing history and do not share data with third parties.",
        },
      ],
      speedLabel: "Average speed",
      speedValue: "94.2",
      speedUnit: "Mbps",
      linkLabel: "Subscription link",
      linkValue: "vipn-connect.space/r/8f3k2m",
      devicesLabel: "Up to 4 devices",
      protocolNote: "DPI · no drops",
    },
    steps: {
      eyebrow: "How it works",
      title: "Connected in a minute",
      lede: "No settings, no manuals: anyone can do it.",
      items: [
        {
          title: "Get a subscription",
          text: "Message us on Telegram and we will send your subscription link within minutes.",
        },
        {
          title: "Install the app",
          text: "Download ViPN for Windows, Android or Linux and paste the link on the first screen.",
        },
        {
          title: "Press Connect",
          text: "That's it. The config refreshes itself when you renew.",
        },
      ],
      note: "All you need is a subscription link — the app does the rest.",
    },
    pricing: {
      eyebrow: "Pricing",
      title: "Pricing",
      lede: "One payment, a month without limits. The more devices, the better the deal.",
      badge: "Most popular",
      plans: [
        {
          name: "Start",
          price: "75",
          period: "₽ / mo",
          devices: "1 device",
          features: [unlimitedEn, "Bypasses blocks", "Config refreshes itself"],
        },
        {
          name: "Family",
          price: "120",
          period: "₽ / mo",
          devices: "2 devices",
          features: [unlimitedEn, "2 devices at once", "Config refreshes itself"],
        },
        {
          name: "Maximum",
          price: "200",
          period: "₽ / mo",
          devices: "4 devices",
          features: [unlimitedEn, "4 devices at once", "All locations"],
        },
      ],
      note: "Online checkout is not connected yet. Message us on Telegram",
      noteTail: " — we issue the subscription and apply your bonus balance.",
      noteDownload: "Download the app",
      assurances: ["Pay via Telegram", "No auto-renewal", "Bonus balance"],
    },
    download: {
      eyebrow: "Clients",
      title: "Download the app",
      lede: "Setup takes a minute. The app is free and your subscription works right after payment.",
      panelTitle: "The internet without borders, on every device",
      panelLede: "One installer, one subscription link and one Connect button.",
      note: "Always the latest version — it updates itself.",
      pageLede: "Pick your device and download the app. The latest version is always here — no manual updates.",
      version: "Version",
      published: "Published",
      latest: "Latest version",
      sizeUnit: "MB",
      recommended: "Recommended",
      assetsLabel: "Files",
      installTitle: "How to install",
      installLede: "Anyone can do it: three steps, no settings.",
      targets: [
        { os: "Linux", files: "ViPN_x.y.z_linux_x64.run" },
        { os: "Windows", files: "ViPN_x.y.z_windows_x64.exe · .msi" },
        { os: "Android", files: "arm64-v8a · armeabi-v7a · x86_64 APK" },
      ],
      guides: [
        {
          os: "Linux",
          text: "Download the .run file, make it executable and start the installer.",
          code: "chmod +x ViPN_*_linux_x64.run && ./ViPN_*_linux_x64.run",
        },
        {
          os: "Windows",
          text: "Run the .exe and follow the installer. The .msi option is for group policy or administrator deployment.",
          file: "ViPN_x.y.z_windows_x64.exe",
        },
        {
          os: "Android",
          text: "Open the downloaded APK and allow installing from this source. arm64-v8a fits most phones.",
          file: "ViPN_x.y.z_android_arm64-v8a.apk",
        },
      ],
      fallback: "Can't download? Message us on Telegram and we'll help you install it.",
      copy: "Copy",
      copied: "Copied",
      back: "Back home",
      noManifest: "The file list will update shortly. Meanwhile, message us on Telegram and we'll send the installer.",
      pending: "Message us on Telegram",
      osNotes: {
        Linux: "Installer for x64 distributions",
        Windows: "Windows 10 and 11, x64",
        Android: "APK for phones and tablets",
      },
    },
    footer: {
      tagline: "The VPN you can't see.",
      note: "We don't keep browsing history and never share data with third parties.",
      rights: "© 2026 ViPN",
      documents: "Documents",
      locations: "Germany · Netherlands",
    },
  },
};

type I18n = { lang: Lang; setLang: (lang: Lang) => void; s: Strings };

const I18nContext = createContext<I18n | null>(null);

const STORAGE_KEY = "vipn-lang";

function readLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ru" || stored === "en") return stored;
    if ((navigator.language || "").toLowerCase().startsWith("en")) return "en";
  } catch {
    return "ru";
  }
  return "ru";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang, s: strings[lang] }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
