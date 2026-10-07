import { useEffect, useState } from "react";
import { BellRing, Download, Loader2, Search, Send } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const fmt = (s) => (s ? s.slice(0, 16).replace("T", " ") : "");

export default function AdminWaitlist() {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/admin/waitlist", { params: { course_id: courseId === "all" ? "" : courseId, status: status === "all" ? "" : status, search } })
      .then(({ data }) => setRows(data)).finally(() => setLoading(false));
  };
  useEffect(() => { document.title = "Yönetim - Haber Ver Listesi"; api.get("/admin/courses").then(({ data }) => setCourses(data)); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [courseId, status, search]);

  const resend = async (r) => {
    setSending(r.email + r.course_id);
    try { await api.post(`/admin/courses/${r.course_id}/waitlist/notify`, { emails: [r.email] }); toast.success("E-posta gönderim sırasına alındı"); setTimeout(load, 1500); }
    catch (e) { toast.error(apiError(e)); } finally { setSending(""); }
  };
  const exportCsv = () => {
    const csv = "\ufeffKurs;Ad;E-posta;Kayıt Tarihi;Durum;Bildirim Tarihi;Gönderilen Kod\n" + rows.map((r) => [r.course_title, r.name || "", r.email, fmt(r.created_at), r.notified_at ? "Bildirildi" : "Bekliyor", fmt(r.notified_at), r.notified_code || ""].join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `haber-ver-listesi-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div data-testid="admin-waitlist-page">
      <p className="overline text-gold mb-2">Pazarlama</p>
      <h1 className="font-heading font-black text-3xl tracking-tight flex items-center gap-3 mb-2"><BellRing className="w-7 h-7 text-gold" /> Haber Ver Listesi</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">Satışa kapalı kurslarda "Açılınca haber ver" diyen ziyaretçiler. Kursu satışa açıp kaydettiğinizde bekleyenlere otomatik e-posta gönderme seçeneği çıkar.</p>
      <div className="bg-ink-surface/60 border border-white/5 rounded-2xl p-4 mb-6 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="E-posta veya isim ara..." className="pl-11 bg-ink border-white/10 rounded-full h-10" data-testid="waitlist-search" /></div>
        <Select value={courseId} onValueChange={setCourseId}><SelectTrigger className="bg-ink border-white/10 h-10 lg:w-64" data-testid="waitlist-course-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tüm kurslar</SelectItem>{courses.map((c) => <SelectItem key={c.course_id} value={c.course_id}>{c.title}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="bg-ink border-white/10 h-10 lg:w-44" data-testid="waitlist-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tüm durumlar</SelectItem><SelectItem value="pending">Bekliyor</SelectItem><SelectItem value="notified">Bildirildi</SelectItem></SelectContent></Select>
        <Button onClick={exportCsv} disabled={!rows.length} className="bg-gold text-ink font-semibold rounded-full h-10" data-testid="waitlist-page-export"><Download className="w-4 h-4 mr-1.5" /> CSV ({rows.length})</Button>
      </div>
      <div className="bg-ink-surface border border-white/5 rounded-2xl divide-y divide-white/5" data-testid="waitlist-table">
        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gold animate-spin" /></div>
          : rows.length === 0 ? <p className="text-sm text-muted-foreground p-8 text-center">Kayıt bulunamadı.</p>
          : rows.map((r) => (
            <div key={r.course_id + r.email} className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid={`waitlist-row-${r.email}`}>
              <div className="min-w-0"><p className="text-sm font-medium truncate">{r.name ? `${r.name} · ` : ""}{r.email}</p>
                <p className="text-xs text-muted-foreground truncate">{r.course_title} · Kayıt: {fmt(r.created_at)}</p></div>
              <div className="flex items-center gap-3 ml-auto">
                {r.notified_at ? <Badge className="bg-green-500/15 text-green-400 border-green-500/25" data-testid={`waitlist-status-${r.email}`}>Bildirildi · {fmt(r.notified_at)}{r.notified_code ? ` · ${r.notified_code}` : ""}</Badge>
                  : <Badge className="bg-gold/15 text-gold border-gold/25" data-testid={`waitlist-status-${r.email}`}>Bekliyor</Badge>}
                <Button size="sm" variant="outline" className="border-white/15 h-8" disabled={sending === r.email + r.course_id} onClick={() => resend(r)} data-testid={`waitlist-resend-${r.email}`}>
                  {sending === r.email + r.course_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" /> {r.notified_at ? "Tekrar gönder" : "Gönder"}</>}
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
