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
  if (t.ga_id) add("ga-src", `<script async src="https://www.googletagmanager.com/gtag/js?id=${t.ga_id}"></script>`) &
    add("ga-init", `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${t.ga_id}');</script>`);
  if (t.google_ads_id) add("gads-init", `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${t.google_ads_id}');</script>`) &
    add("gads-src", `<script async src="https://www.googletagmanager.com/gtag/js?id=${t.google_ads_id}"></script>`);
  if (t.meta_pixel_id) add("meta-pixel", `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.meta_pixel_id}');fbq('track','PageView');</script>`);
  if (t.head_code) add("custom-head", t.head_code);
  if (t.body_code) add("custom-body", t.body_code, document.body);
}

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState({ site_name: "Kamil Yıldırım Akademi" });
  const [loading, setLoading] = useState(true);
  const injected = useRef(false);
  useEffect(() => {
    api.get("/settings/public").then(({ data }) => {
      setSettings(data);
      if (!injected.current) { injected.current = true; try { injectTracking(data.tracking); } catch {} }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  return <SiteContext.Provider value={{ settings, loading }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
