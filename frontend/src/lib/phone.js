// Normalizes a TR number to wa.me format (90XXXXXXXXXX).
export function waNumber(raw) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `90${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("5")) d = `90${d}`;
  return d;
}

export const telHref = (raw) => `tel:${(raw || "").replace(/[^\d+]/g, "")}`;
