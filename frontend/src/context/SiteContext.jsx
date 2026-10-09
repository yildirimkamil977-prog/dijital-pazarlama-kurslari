import { useEffect, useState, createContext, useContext, useRef } from "react";
import api from "@/lib/api";

const SiteContext = createContext({ settings: {}, loading: true });

function injectTracking(t) {
  if (!t) return;
  const add = (id, html, target = document.head) => {
    if (document.getElementById(id)) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    Array.from(wrap.childNodes).forEach((n) => {
      if (n.tagName === "SCRIPT") {
        const s = document.createElement("script");
        Array.from(n.attributes).forEach((a) => s.setAttribute(a.name, a.value));
        s.innerHTML = n.innerHTML; s.id = id; target.appendChild(s);
      } else if (n.nodeType === 1) { n.id = id + "-el"; target.appendChild(n); }
    });
    const marker = document.createElement("meta"); marker.id = id; target.appendChild(marker);
  };
  if (t.ga_id) add("ga-src", `<script async src="https://www.googletagmanager.com/gtag/js?id=${t.ga_id}"></script>`);
  if (t.google_ads_id && !t.ga_id) add("gads-src", `<script async src="https://www.googletagmanager.com/gtag/js?id=${t.google_ads_id}"></script>`);
  if (t.meta_pixel_id) add("meta-pixel", `<script async src="https://connect.facebook.net/en_US/fbevents.js"></script>`);
  if (t.head_code) add("custom-head", t.head_code);
  if (t.body_code) add("custom-body", t.body_code, document.body);
}

// Queue stubs are created immediately so early events (e.g. purchase on the result page) are not lost before scripts load.
function setupTrackingStubs(t) {
  if (!t) return;
  window.__SITE_TRACKING__ = t;
  if (t.ga_id || t.google_ads_id) {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    if (t.ga_id) window.gtag("config", t.ga_id);
    if (t.google_ads_id) window.gtag("config", t.google_ads_id);
  }
  if (t.meta_pixel_id && !window.fbq) {
    const n = (window.fbq = function fbq() { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    window.fbq("init", t.meta_pixel_id);
    window.fbq("track", "PageView");
  }
}

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(() => (typeof window !== "undefined" && window.__SETTINGS__) || { site_name: "Kamil Yıldırım Akademi" });
  const [loading, setLoading] = useState(true);
  const injected = useRef(false);
  useEffect(() => {
    api.get("/settings/public").then(({ data }) => {
      setSettings(data);
      if (!injected.current) { injected.current = true; try { setupTrackingStubs(data.tracking); } catch {} let done = false; const run = () => { if (done) return; done = true; try { injectTracking(data.tracking); } catch {} }; ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => window.addEventListener(ev, run, { once: true, passive: true })); const later = () => setTimeout(run, 5000); document.readyState === "complete" ? later() : window.addEventListener("load", later, { once: true }); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return <SiteContext.Provider value={{ settings, loading }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
