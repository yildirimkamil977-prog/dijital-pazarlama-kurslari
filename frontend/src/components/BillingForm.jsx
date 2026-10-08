import { User, Building2, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trCities } from "@/data/trCities";
import { toast } from "sonner";

export const EMPTY_BILLING = { type: "individual", tckn: "", company_name: "", tax_office: "", tax_no: "", city: "", district: "", address: "" };

export const hasBilling = (b) => !!b && ["tckn", "company_name", "tax_no", "tax_office", "city", "address"].some((k) => (b[k] || "").trim());

export const billingRows = (b, name) => {
  if (!b) return [];
  const corp = b.type === "corporate";
  return [
    ["Tür", corp ? "Kurumsal" : "Bireysel"],
    ...(corp ? [["Firma Ünvanı", b.company_name], ["Vergi Dairesi", b.tax_office], ["Vergi No", b.tax_no]] : [["Ad Soyad", name], ["TC Kimlik No", b.tckn]]),
    ["İl / İlçe", [b.city, b.district].filter(Boolean).join(" / ")],
    ["Adres", b.address],
  ].filter(([, v]) => v);
};

export const copyBilling = (b, name) => {
  navigator.clipboard.writeText(billingRows(b, name).map(([k, v]) => `${k}: ${v}`).join("\n"));
  toast.success("Fatura bilgileri kopyalandı");
};

export function BillingSummary({ billing, name, testId = "billing-summary", copy = false }) {
  if (!hasBilling(billing)) return <p className="text-sm text-muted-foreground" data-testid={`${testId}-empty`}>Fatura bilgisi girilmemiş.</p>;
  return (
    <div className="relative" data-testid={testId}>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
        {billingRows(billing, name).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground text-xs pt-0.5">{k}</dt><dd className="break-words">{v}</dd></div>)}
      </dl>
      {copy && <button type="button" onClick={() => copyBilling(billing, name)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-gold border border-gold/30 rounded-lg px-2.5 py-1.5 hover:bg-gold/10 transition-colors duration-200" data-testid={`${testId}-copy`}><Copy className="w-3.5 h-3.5" /> Kopyala</button>}
    </div>
  );
}

export function BillingFields({ billing, setBilling, inputCls = "bg-ink border-white/10 mt-1.5" }) {
  const set = (k, v) => setBilling({ ...billing, [k]: v });
  const districts = trCities.find((c) => c.name === billing.city)?.districts || [];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[["individual", "Bireysel", User], ["corporate", "Kurumsal", Building2]].map(([v, l, Ic]) => (
          <button type="button" key={v} onClick={() => set("type", v)} data-testid={`billing-${v}`}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors duration-200 ${billing.type === v ? "border-gold bg-gold/10 text-gold" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
            <Ic className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {billing.type === "corporate" ? (
          <>
            <div><Label>Firma Ünvanı</Label><Input value={billing.company_name} onChange={(e) => set("company_name", e.target.value)} className={inputCls} data-testid="billing-company" /></div>
            <div><Label>Vergi No</Label><Input value={billing.tax_no} onChange={(e) => set("tax_no", e.target.value)} className={inputCls} data-testid="billing-taxno" /></div>
            <div className="sm:col-span-2"><Label>Vergi Dairesi</Label><Input value={billing.tax_office} onChange={(e) => set("tax_office", e.target.value)} className={inputCls} data-testid="billing-taxoffice" /></div>
          </>
        ) : (
          <div className="sm:col-span-2"><Label>TC Kimlik No</Label><Input value={billing.tckn} onChange={(e) => set("tckn", e.target.value)} className={inputCls} data-testid="billing-tckn" /></div>
        )}
        <div>
          <Label>İl</Label>
          <Select value={billing.city} onValueChange={(v) => setBilling({ ...billing, city: v, district: "" })}>
            <SelectTrigger className={inputCls} data-testid="billing-city"><SelectValue placeholder="Şehir seçin" /></SelectTrigger>
            <SelectContent className="max-h-72">{trCities.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>İlçe</Label>
          <Select value={billing.district} onValueChange={(v) => set("district", v)} disabled={!billing.city}>
            <SelectTrigger className={inputCls} data-testid="billing-district"><SelectValue placeholder={billing.city ? "İlçe seçin" : "Önce şehir seçin"} /></SelectTrigger>
            <SelectContent className="max-h-72">{districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2"><Label>Adres</Label><Textarea value={billing.address} onChange={(e) => set("address", e.target.value)} className={inputCls} rows={2} placeholder="Mahalle, cadde, kapı no..." data-testid="billing-address" /></div>
      </div>
    </>
  );
}
