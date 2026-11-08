import { Download } from "./components/Download";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Pricing } from "./components/Pricing";
import { Steps } from "./components/Steps";

export default function App() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Features />
        <Steps />
        <Pricing />
        <Download />
      </main>
      <Footer />
    </>
  );
}
