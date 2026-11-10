import { useEffect } from "react";
import { Download } from "./components/Download";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { MobileCta } from "./components/MobileCta";
import { Pricing } from "./components/Pricing";
import { Steps } from "./components/Steps";
import { Ticker } from "./components/Stats";
import { useI18n } from "./i18n";
import { useReveal } from "./useReveal";

export default function App() {
  const { lang, s } = useI18n();
  useReveal();

  useEffect(() => {
    document.title = s.meta.homeTitle;
  }, [s]);

  return (
    <>
      <a className="skip-link" href="#main">
        {lang === "ru" ? "К основному содержимому" : "Skip to content"}
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Ticker />
        <Features />
        <Steps />
        <Pricing />
        <Download />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}
