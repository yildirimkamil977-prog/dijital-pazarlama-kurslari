// Meta Pixel + Google Ads/GA4 conversion helpers.
// Conversion IDs come from public settings (window.__SITE_TRACKING__ set by SiteContext).

const cfg = () => (typeof window !== "undefined" && window.__SITE_TRACKING__) || {};

function meta(event, params, eventId) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try { window.fbq("track", event, params || {}, eventId ? { eventID: eventId } : undefined); } catch { /* noop */ }
  }
}
function ga(event, params) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    try { window.gtag("event", event, params || {}); } catch { /* noop */ }
  }
}
function adsConversion(labelKey, params) {
  const t = cfg();
  if (t.google_ads_id && t[labelKey]) ga("conversion", { send_to: `${t.google_ads_id}/${t[labelKey]}`, ...params });
}

const gaItems = (items) => items.map((i) => ({ item_id: i.id, item_name: i.title, price: i.price, item_category: i.category || "", quantity: 1 }));

export const toTrackItems = (items = []) => items.map((i) => ({
  id: i.course_id || i.group_id || i.id, title: i.title, price: Number(i.price) || 0,
  category: i.group_id ? "Canlı Grup Eğitimi" : i.type === "consulting" ? "Danışmanlık" : "Video Kurs",
}));

export function trackViewContent({ id, title, price, category, currency = "TRY" }) {
  meta("ViewContent", { content_ids: [id], content_name: title, content_category: category, content_type: "product", value: price, currency });
  ga("view_item", { currency, value: price, items: gaItems([{ id, title, price, category }]) });
}

export function trackAddToCart({ id, title, price, category, currency = "TRY" }) {
  meta("AddToCart", { content_ids: [id], content_name: title, content_type: "product", value: price, currency });
  ga("add_to_cart", { currency, value: price, items: gaItems([{ id, title, price, category }]) });
  adsConversion("google_ads_add_to_cart_label", { value: price, currency });
}

export function trackInitiateCheckout({ value, currency = "TRY", items = [] }) {
  meta("InitiateCheckout", { value, currency, num_items: items.length, content_ids: items.map((i) => i.id), content_type: "product" });
  ga("begin_checkout", { currency, value, items: gaItems(items) });
  adsConversion("google_ads_checkout_label", { value, currency });
}

export function trackRegister(method = "email") {
  meta("CompleteRegistration", { status: true });
  ga("sign_up", { method });
}

// Fires once per order (guards against page refresh double counting).
export function trackPurchase({ orderId, value, currency = "TRY", items = [] }) {
  const key = `tracked_purchase_${orderId}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { /* noop */ }
  meta("Purchase", { value, currency, content_ids: items.map((i) => i.id), contents: items.map((i) => ({ id: i.id, quantity: 1, item_price: i.price })), content_type: "product", num_items: items.length }, orderId);
  ga("purchase", { transaction_id: orderId, value, currency, items: gaItems(items) });
  adsConversion("google_ads_purchase_label", { value, currency, transaction_id: orderId });
}
