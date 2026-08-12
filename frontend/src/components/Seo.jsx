import { useEffect } from "react";

function setMeta(attr, key, content) {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

export function Seo({ title, description, keywords, image, url, jsonLd }) {
  const ld = jsonLd ? JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : null;
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMeta("name", "description", description);
    if (keywords) setMeta("name", "keywords", keywords);
    setMeta("property", "og:title", title || "");
    setMeta("property", "og:description", description || "");
    setMeta("property", "og:type", "website");
    if (image) setMeta("property", "og:image", image);
    setMeta("property", "og:url", url || window.location.href);
    setMeta("name", "twitter:card", "summary_large_image");

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "canonical"); document.head.appendChild(link); }
    link.setAttribute("href", url || window.location.href);

    const prev = document.getElementById("seo-jsonld");
    if (prev) prev.remove();
    if (ld) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = "seo-jsonld";
      s.text = ld;
      document.head.appendChild(s);
    }
  }, [title, description, keywords, image, url, ld]);
  return null;
}
