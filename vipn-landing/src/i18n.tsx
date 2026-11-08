import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "ru" | "en";

type Feature = { title: string; text: string };
type Step = { title: string; text: string };
type Plan = { name: string; price: string; period: string; devices: string; features: string[] };
type Target = { os: string; files: string };
type Guide = { os: string; text: string; code?: string };

export type Strings = {
  navLabel: string;
  langLabel: string;
  nav: { features: string; pricing: string; download: string };
  actions: { download: string; pricing: string; release: string; login: string; buy: string };
  hero: { title: string; lede: string; specs: string[] };
  ping: {
    title: string;
    place: string;
    unit: string;
    measure: string;
    measuring: string;
    again: string;
    error: string;
    note: string;
  };
  features: { title: string; lede: string; items: Feature[] };
  steps: { title: string; lede: string; items: Step[] };
  pricing: {
    title: string;
    lede: string;
    plans: Plan[];
    note: string;
    noteTail: string;
    noteDownload: string;
  };
  download: {
    title: string;
    teaserLede: string;
    pageLede: string;
    hint: string;
    targets: Target[];
    version: string;
    sizeUnit: string;
    recommended: string;
    installTitle: string;
    installLede: string;
    guides: Guide[];
    fallback: string;
  };
  footer: { tagline: string };
};

const unlimitedRu = "Безлимитный трафик";
const unlimitedEn = "Unlimited traffic";

export const strings: Record<Lang, Strings> = {
  ru: {
    navLabel: "Разделы",
    langLabel: "Язык",
    nav: { features: "Возможности", pricing: "Тарифы", download: "Скачать" },
    actions: {
      download: "Скачать клиент",
      pricing: "Посмотреть тарифы",
      release: "Открыть последний релиз",
      login: "Войти",
      buy: "Купить",
    },
    hero: {
      title: "VPN, которого не видно",
      lede: "YouTube, Instagram, Telegram и любимые сериалы снова работают — без тормозов и «недоступно в вашем регионе». Подключение за минуту, одна подписка на все устройства.",
      specs: ["Обходит блокировки", "до 4 устройств", "безлимитный трафик", "Linux, Windows, Android"],
    },
    ping: {
      title: "Пинг до сервера",
      place: "Германия",
      unit: "мс",
      measure: "Проверить скорость",
      measuring: "Проверяем…",
      again: "Проверить ещё",
      error: "Не удалось измерить",
      note: "Реальный замер из вашего браузера",
    },
    features: {
      title: "Почему выбирают ViPN",
      lede: "Быстро, просто и без лишних вопросов. Мы убрали всё, что обычно мешает пользоваться VPN.",
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
    },
    steps: {
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
    },
    pricing: {
      title: "Тарифы",
      lede: "Один платёж — месяц без ограничений. Чем больше устройств, тем выгоднее подписка.",
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
          features: [unlimitedRu, "Обход блокировок", "2 устройства одновременно"],
        },
        {
          name: "Максимум",
          price: "200",
          period: "₽ / мес",
          devices: "4 устройства",
          features: [unlimitedRu, "Обход блокировок", "4 устройства одновременно"],
        },
      ],
      note: "Онлайн-оплата пока не подключена. Напишите в Telegram",
      noteTail: " — оформим подписку и учтём бонусный баланс.",
      noteDownload: "Скачать приложение",
    },
    download: {
      title: "Скачать клиент",
      teaserLede: "Установка занимает минуту. Приложение бесплатное, а подписка работает сразу после оплаты.",
      pageLede: "Выберите своё устройство и скачайте приложение. Здесь всегда свежая версия — обновлять вручную не нужно.",
      hint: "Windows: выберите .exe для обычной установки.",
      version: "Версия",
      sizeUnit: "МБ",
      recommended: "*Подходит для большинства устройств",
      targets: [
        { os: "Linux", files: "ViPN_x.y.z_linux_x64.run" },
        { os: "Windows", files: "ViPN_x.y.z_windows_x64.exe · .msi" },
        { os: "Android", files: "arm64-v8a · armeabi-v7a · x86_64 APK" },
      ],
      installTitle: "Как установить",
      installLede: "Справится любой: три шага и никаких настроек.",
      guides: [
        {
          os: "Linux",
          text: "Скачайте .run, сделайте файл исполняемым и запустите установщик.",
          code: "chmod +x ViPN_*_linux_x64.run && ./ViPN_*_linux_x64.run",
        },
        {
          os: "Windows",
          text: "Запустите .exe и следуйте мастеру установки. Вариант .msi — для установки через групповые политики или администратора.",
        },
        {
          os: "Android",
          text: "Откройте скачанный APK и разрешите установку из этого источника. Для большинства телефонов подходит arm64-v8a.",
        },
      ],
      fallback: "Не получается скачать? Напишите в Telegram — поможем. Или откройте релиз на GitHub.",
    },
    footer: { tagline: "VPN, который не видно. © 2026" },
  },
  en: {
    navLabel: "Sections",
    langLabel: "Language",
    nav: { features: "Features", pricing: "Pricing", download: "Download" },
    actions: {
      download: "Get the app",
      pricing: "See pricing",
      release: "Open the latest release",
      login: "Log in",
      buy: "Buy",
    },
    hero: {
      title: "A VPN that doesn't look like one",
      lede: "YouTube, Instagram, Telegram and your favourite shows work again — no slowdowns, no “not available in your region”. Set up in a minute, one subscription for every device.",
      specs: ["Bypasses blocks", "up to 4 devices", "unlimited traffic", "Linux, Windows, Android"],
    },
    ping: {
      title: "Ping to the server",
      place: "Germany",
      unit: "ms",
      measure: "Check speed",
      measuring: "Checking…",
      again: "Check again",
      error: "Could not measure",
      note: "A real measurement from your browser",
    },
    features: {
      title: "Why people choose ViPN",
      lede: "Fast, simple and private. We removed everything that usually gets in the way of using a VPN.",
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
    },
    steps: {
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
    },
    pricing: {
      title: "Pricing",
      lede: "One payment, a month without limits. The more devices, the better the deal.",
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
          features: [unlimitedEn, "Bypasses blocks", "2 devices at once"],
        },
        {
          name: "Maximum",
          price: "200",
          period: "₽ / mo",
          devices: "4 devices",
          features: [unlimitedEn, "Bypasses blocks", "4 devices at once"],
        },
      ],
      note: "Online checkout is not connected yet. Message us on Telegram",
      noteTail: " — we issue the subscription and apply your bonus balance.",
      noteDownload: "Download the app",
    },
    download: {
      title: "Download the app",
      teaserLede: "Setup takes a minute. The app is free and your subscription works right after payment.",
      pageLede: "Pick your device and download the app. The latest version is always here — no manual updates.",
      hint: "Windows: pick the .exe for a regular install.",
      version: "Version",
      sizeUnit: "MB",
      recommended: "*Fits most devices",
      targets: [
        { os: "Linux", files: "ViPN_x.y.z_linux_x64.run" },
        { os: "Windows", files: "ViPN_x.y.z_windows_x64.exe · .msi" },
        { os: "Android", files: "arm64-v8a · armeabi-v7a · x86_64 APK" },
      ],
      installTitle: "How to install",
      installLede: "Anyone can do it: three steps, no settings.",
      guides: [
        {
          os: "Linux",
          text: "Download the .run file, make it executable and start the installer.",
          code: "chmod +x ViPN_*_linux_x64.run && ./ViPN_*_linux_x64.run",
        },
        {
          os: "Windows",
          text: "Run the .exe and follow the installer. The .msi option is for group policy or administrator deployment.",
        },
        {
          os: "Android",
          text: "Open the downloaded APK and allow installing from this source. arm64-v8a fits most phones.",
        },
      ],
      fallback: "Can't download? Message us on Telegram and we'll help. Or open the GitHub release.",
    },
    footer: { tagline: "The VPN you can't see. © 2026" },
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
