import { useEffect, useState } from "react";

function diff(target) {
  const t = new Date(target).getTime() - Date.now();
  if (isNaN(t) || t <= 0) return null;
  return {
    d: Math.floor(t / 86400000),
    h: Math.floor((t % 86400000) / 3600000),
    m: Math.floor((t % 3600000) / 60000),
    s: Math.floor((t % 60000) / 1000),
  };
}

export function Countdown({ target, className = "", onDone }) {
  const [left, setLeft] = useState(() => diff(target));
  useEffect(() => {
    const id = setInterval(() => {
      const nv = diff(target);
      setLeft(nv);
      if (!nv && onDone) onDone();
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!left) return null;
  const cell = (v, label) => (
    <div className="flex flex-col items-center bg-ink/60 border border-white/10 rounded-xl px-3 py-2 min-w-[54px]">
      <span className="font-heading font-black text-2xl text-gold tabular-nums leading-none">{String(v).padStart(2, "0")}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</span>
    </div>
  );
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="countdown">
      {cell(left.d, "Gün")}{cell(left.h, "Saat")}{cell(left.m, "Dk")}{cell(left.s, "Sn")}
    </div>
  );
}
