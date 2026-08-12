// Meta Pixel + Google Ads/GA4 conversion helpers.
// Reads conversion IDs from public settings (window.__SITE_TRACKING__ set by SiteContext).

function meta(event, params) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try { window.fbq("track", event, params || {}); } catch { /* noop */ }
  }
}
function ga(event, params) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    try { window.gtag("event", event, params || {}); } catch { /* noop */ }
  }
}

export function trackAddToCart({ id, title, price, currency = "TRY" }) {
  meta("AddToCart", { content_ids: [id], content_name: title, value: price, currency });
  ga("add_to_cart", { currency, value: price, items: [{ item_id: id, item_name: title, price }] });
}

export function trackInitiateCheckout({ value, currency = "TRY", numItems }) {
  meta("InitiateCheckout", { value, currency, num_items: numItems });
  ga("begin_checkout", { currency, value });
}

export function trackRegister(method = "email") {
  meta("CompleteRegistration", { status: true });
  ga("sign_up", { method });
}

export function trackPurchase({ orderId, value, currency = "TRY", items = [] }) {
  meta("Purchase", { value, currency, contents: items.map((i) => ({ id: i.id, quantity: 1 })), content_type: "product" });
  ga("purchase", { transaction_id: orderId, value, currency, items: items.map((i) => ({ item_id: i.id, item_name: i.title, price: i.price })) });
  // Google Ads conversion (if label configured)
  const t = (typeof window !== "undefined" && window.__SITE_TRACKING__) || {};
  if (t.google_ads_id && t.google_ads_purchase_label) {
    ga("conversion", { send_to: `${t.google_ads_id}/${t.google_ads_purchase_label}`, value, currency, transaction_id: orderId });
  }
}
