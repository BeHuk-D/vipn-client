import { useEffect } from "react";

export function useReveal() {
  useEffect(() => {
    const observed = new WeakSet<Element>();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supported = "IntersectionObserver" in window;

    const observer = supported
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                observer?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
        )
      : null;

    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        if (reduce || !observer) {
          element.classList.add("is-in");
          return;
        }
        observer.observe(element);
      });
    };

    scan();

    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer?.disconnect();
    };
  }, []);
}
