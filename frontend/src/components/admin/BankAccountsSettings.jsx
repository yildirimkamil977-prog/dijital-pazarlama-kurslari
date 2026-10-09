import { useEffect, useState } from "react";
import { Loader2, Save, Plus, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";

const EMPTY = { bank_name: "", holder: "", iban: "", branch: "" };
const inputCls = "bg-ink border-white/10 mt-1.5";
const formatIban = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})/g, "$1 ").trim();

export function BankAccountsSettings({ initial }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRows(initial?.length ? initial : [{ ...EMPTY }]); }, [initial]);
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    const clean = rows.filter((r) => r.iban.trim() || r.bank_name.trim());
    if (clean.some((r) => r.iban.replace(/\s/g, "").length !== 26 || !r.iban.toUpperCase().startsWith("TR"))) { toast.error("IBAN 'TR' ile başlamalı ve 26 karakter olmalı"); return; }
    setBusy(true);
    try { await api.put("/admin/settings/bank-accounts", clean); setRows(clean.length ? clean : [{ ...EMPTY }]); toast.success("Banka hesapları kaydedildi"); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="bank-accounts-settings">
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p>Burada girdiğiniz hesaplar ödeme sayfasında Havale/EFT seçildiğinde, sipariş sonrası ekranda ve müşteriye giden havale bilgilendirme e-postasında gösterilir.</p>
      </div>
      {rows.map((r, i) => (
        <section key={i} className="bg-ink-surface border border-white/5 rounded-2xl p-6" data-testid={`bank-account-${i}`}>
          <div className="flex items-center justify-between mb-4">
            <p className="font-heading font-semibold text-sm">Hesap {i + 1}</p>
            <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => setRows(rows.filter((_, j) => j !== i))} data-testid={`bank-remove-${i}`}><Trash2 className="w-4 h-4" /></Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Banka Adı</Label><Input value={r.bank_name} onChange={(e) => set(i, "bank_name", e.target.value)} className={inputCls} placeholder="Örn. Ziraat Bankası" data-testid={`bank-name-${i}`} /></div>
            <div><Label>Hesap Sahibi</Label><Input value={r.holder} onChange={(e) => set(i, "holder", e.target.value)} className={inputCls} placeholder="Ad Soyad / Firma Ünvanı" data-testid={`bank-holder-${i}`} /></div>
            <div><Label>IBAN</Label><Input value={r.iban} onChange={(e) => set(i, "iban", formatIban(e.target.value))} className={`${inputCls} font-mono`} placeholder="TR00 0000 0000 0000 0000 0000 00" maxLength={32} data-testid={`bank-iban-${i}`} /></div>
            <div><Label>Şube <span className="text-muted-foreground font-normal">· isteğe bağlı</span></Label><Input value={r.branch} onChange={(e) => set(i, "branch", e.target.value)} className={inputCls} data-testid={`bank-branch-${i}`} /></div>
          </div>
        </section>
      ))}
      <div className="flex gap-3">
        <Button variant="outline" className="border-white/15" onClick={() => setRows([...rows, { ...EMPTY }])} data-testid="bank-add"><Plus className="w-4 h-4 mr-2" /> Hesap Ekle</Button>
        <Button onClick={save} disabled={busy} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-bank-accounts">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
      </div>
    </div>
  );
}
