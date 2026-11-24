import { useEffect } from "react";

// Lifts 3rd-party chat launchers (Crisp etc.) above any fixed mobile bar marked with data-mobile-bar.
const SEL = ".crisp-client *, #crisp-chatbox *";

export function ChatLift() {
  useEffect(() => {
    const moved = new Map();
    const restore = () => {
      moved.forEach((v, el) => { el.style.removeProperty("bottom"); if (v.prev) el.style.setProperty("bottom", v.prev); });
      moved.clear();
    };
    const apply = () => {
      const bar = document.querySelector("[data-mobile-bar]");
      if (!bar || bar.offsetHeight === 0) { restore(); return; }
      const offset = bar.offsetHeight + 12;
      document.querySelectorAll(SEL).forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" || el.offsetHeight === 0 || el.offsetHeight > 140) return;
        if (!moved.has(el)) {
          const b = parseFloat(cs.bottom);
          if (Number.isNaN(b) || b > 60) return;
          moved.set(el, { prev: el.style.getPropertyValue("bottom"), base: b });
        }
        const want = `${moved.get(el).base + offset}px`;
        if (el.style.getPropertyValue("bottom") !== want) el.style.setProperty("bottom", want, "important");
      });
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", apply);
    return () => { obs.disconnect(); window.removeEventListener("resize", apply); restore(); };
  }, []);
  return null;
}
