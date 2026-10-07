import { useEffect, useState } from "react";
import api from "@/lib/api";

export function optImg(url, w = 800) {
  if (!url || url.includes("?")) return url;
  if (url.includes("/api/uploads/img_")) return `${url}?w=${w}`;
  if (url.includes("images.pexels.com")) return `${url}?auto=compress&cs=tinysrgb&w=${w}`;
  return url;
}

export function takeInitial(key) {
  const store = typeof window !== "undefined" ? window.__INITIAL__ : null;
  if (!store || !store[key]) return null;
  const data = store[key];
  delete store[key];
  return data;
}

export function usePageSeo(path) {
  const pre = typeof window !== "undefined" && window.__SEO__ && window.__SEO__.canonical?.endsWith(path) ? window.__SEO__ : null;
  const [seo, setSeo] = useState(pre);
  useEffect(() => {
    if (pre) return;
    api.get("/seo/meta", { params: { path } }).then(({ data }) => setSeo(data)).catch(() => {});
    // eslint-disable-next-line
  }, [path]);
  return seo;
}
