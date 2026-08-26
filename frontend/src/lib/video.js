// Normalizes any YouTube/Vimeo share or embed URL into a proper iframe embed URL.
// Vimeo embeds include privacy/anti-download params (dnt, no download UI, no pip/badge).
export function toEmbed(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.includes("vimeo.com")) {
      let base;
      if (u.hostname.includes("player.vimeo.com")) {
        base = url.split("?")[0];
      } else {
        const parts = u.pathname.split("/").filter(Boolean);
        const id = parts[0];
        const h = parts[1];
        base = `https://player.vimeo.com/video/${id}` + (h ? `?h=${h}` : "");
      }
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}dnt=1&title=0&byline=0&portrait=0&pip=0&badge=0`;
    }
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch (e) {
    return url;
  }
  return url;
}
