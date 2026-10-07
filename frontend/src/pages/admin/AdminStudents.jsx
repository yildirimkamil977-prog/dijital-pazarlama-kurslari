import { useEffect, useState, useRef } from "react";
import { Loader2, Search, BookOpen, Plus, Trash2, KeyRound, Upload, Download, Award, ChevronLeft, ChevronRight, ShoppingBag, Users, FileDown, RotateCcw } from "lucide-react";
import { MultiSelectFilter } from "@/components/admin/MultiSelectFilter";
import api, { formatPrice, formatDate, apiError, API } from "@/lib/api";

const SRC_LABEL = { purchase: "Satın Alma", free: "Ücretsiz", transfer: "Havale/EFT", manual: "Manuel Kayıt", gift: "Hediye" };
const srcLabel = (s) => SRC_LABEL[s] || "Manuel Kayıt";
const STATUS_LABEL = { paid: "Ödendi", pending: "Bekliyor", awaiting_transfer: "Havale Bekleniyor", failed: "Başarısız", token_failed: "Başarısız" };
const statusLabel = (s) => STATUS_LABEL[s] || s;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminStudents() {
  const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [courseIds, setCourseIds] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [courseToAdd, setCourseToAdd] = useState("");
  const [certCourse, setCertCourse] = useState("");
  const invRefs = useRef({});
  const certRef = useRef(null);

  const filterParams = () => ({ search, start_date: startDate, end_date: endDate, course_ids: courseIds.join(","), group_ids: groupIds.join(",") });
  const load = () => { setLoading(true); api.get("/admin/students", { params: { ...filterParams(), page, limit: 8 } }).then(({ data }) => setData(data)).finally(() => setLoading(false)); };
  useEffect(() => { document.title = "Yönetim - Öğrenciler"; api.get("/admin/courses").then(({ data }) => setCourses(data)); api.get("/admin/group-trainings").then(({ data }) => setGroups(data)); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search, page, startDate, endDate, courseIds, groupIds]);
  const setFilter = (fn) => (v) => { setPage(1); fn(v); };
  const hasFilters = search || startDate || endDate || courseIds.length || groupIds.length;
  const resetFilters = () => { setPage(1); setSearch(""); setStartDate(""); setEndDate(""); setCourseIds([]); setGroupIds([]); };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get("/admin/students/export", { params: filterParams(), responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `ogrenciler-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV indirildi");
    } catch (e) { toast.error("Dışa aktarma başarısız"); } finally { setExporting(false); }
  };

  const openDetail = async (uid) => { const { data } = await api.get(`/admin/students/${uid}`); setDetail(data); };
  const refreshDetail = () => detail && openDetail(detail.user.user_id);

  const enroll = async () => { if (!courseToAdd) return; try { await api.post("/admin/enrollments", { user_id: detail.user.user_id, course_id: courseToAdd }); toast.success("Kursa eklendi"); setCourseToAdd(""); refreshDetail(); load(); } catch (e) { toast.error(apiError(e)); } };
  const unenroll = async (cid) => { await api.delete("/admin/enrollments", { data: { user_id: detail.user.user_id, course_id: cid } }); toast.success("Kayıt kaldırıldı"); refreshDetail(); load(); };
  const resetPw = async () => { try { const { data } = await api.post(`/admin/students/${detail.user.user_id}/reset-password`); toast.success("Yeni şifre e-posta ile gönderildi"); } catch (e) { toast.error(apiError(e)); } };
  const uploadInvoice = async (oid, file) => { if (!file) return; const fd = new FormData(); fd.append("file", file); try { await api.post(`/admin/payments/${oid}/invoice`, fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Fatura yüklendi"); refreshDetail(); } catch (e) { toast.error(apiError(e)); } };
  const uploadCert = async (file) => { if (!file || !certCourse) { toast.error("Önce kurs seç"); return; } const fd = new FormData(); fd.append("file", file); try { await api.post(`/admin/students/${detail.user.user_id}/certificate?course_id=${certCourse}`, fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Sertifika yüklendi"); setCertCourse(""); refreshDetail(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter mb-6">Öğrenciler <span className="text-base text-muted-foreground font-normal">({data.total})</span></h1>
      <div className="bg-ink-surface/60 border border-white/5 rounded-2xl p-4 mb-6 space-y-3" data-testid="student-filters">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="İsim, e-posta veya telefon ara..." className="pl-11 bg-ink border-white/10 rounded-full h-10" data-testid="student-search" />
          </div>
          <Button onClick={exportCsv} disabled={exporting} className="bg-gold text-ink font-semibold rounded-full h-10 shrink-0" data-testid="export-students-csv">
            {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileDown className="w-4 h-4 mr-1.5" />} CSV Dışa Aktar ({data.total})
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">Kayıt:</span>
            <Input type="date" value={startDate} onChange={(e) => setFilter(setStartDate)(e.target.value)} className="bg-ink border-white/10 flex-1 min-w-0 sm:w-[150px] sm:flex-none h-10" data-testid="student-start-date" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={endDate} onChange={(e) => setFilter(setEndDate)(e.target.value)} className="bg-ink border-white/10 flex-1 min-w-0 sm:w-[150px] sm:flex-none h-10" data-testid="student-end-date" />
          </div>
          <MultiSelectFilter label="Kurslar" testId="filter-courses" value={courseIds} onChange={setFilter(setCourseIds)} options={courses.map((c) => ({ id: c.course_id, label: c.title }))} />
          <MultiSelectFilter label="Grup Eğitimleri" testId="filter-groups" value={groupIds} onChange={setFilter(setGroupIds)} options={groups.map((g) => ({ id: g.group_id, label: g.title }))} />
          {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground h-10" data-testid="reset-student-filters"><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Sıfırla</Button> : null}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div> : (
        <>
          <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            {data.items.length === 0 ? <p className="text-muted-foreground text-center py-16">Öğrenci bulunamadı.</p> : data.items.map((sdt) => (
              <div key={sdt.user_id} data-testid={`student-${sdt.user_id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition-colors duration-200">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-gold text-ink flex items-center justify-center font-bold shrink-0">{(sdt.name || "?").charAt(0).toUpperCase()}</span>
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{sdt.name}</p><p className="text-xs text-muted-foreground truncate">{sdt.email}{sdt.phone ? ` · ${sdt.phone}` : ""}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5" data-testid={`student-created-${sdt.user_id}`}>Kayıt: {formatDate(sdt.created_at)}</p>
                    {sdt.matched?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{sdt.matched.map((m) => <Badge key={m} className="bg-gold/10 text-gold border-gold/20 text-[10px] font-normal">{m}</Badge>)}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-auto">
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5" title="Kurs"><BookOpen className="w-3.5 h-3.5" /> {sdt.enrollment_count}</span>
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5" title="Grup eğitimi"><Users className="w-3.5 h-3.5" /> {sdt.groups?.length || 0}</span>
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5" title="Sipariş" data-testid={`student-orders-${sdt.user_id}`}><ShoppingBag className="w-3.5 h-3.5" /> {sdt.order_count}</span>
                  <span className="text-sm font-heading font-bold text-gold">{formatPrice(sdt.total_spent)} ₺</span>
                  <Button variant="outline" size="sm" className="border-white/15" onClick={() => openDetail(sdt.user_id)} data-testid={`manage-student-${sdt.user_id}`}>Profili Aç</Button>
                </div>
              </div>
            ))}
          </div>
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" className="border-white/15" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm text-muted-foreground">Sayfa {data.page} / {data.pages}</span>
              <Button variant="outline" size="sm" className="border-white/15" disabled={page >= data.pages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-ink-surface border-white/10 max-w-2xl max-h-[88vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.user.name} · {detail.user.email}</DialogTitle></DialogHeader>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {detail.user.phone && <Badge className="bg-secondary">{detail.user.phone}</Badge>}
                <Badge className="bg-secondary">{detail.user.auth_provider === "google" ? "Google" : "E-posta"}</Badge>
                <Button variant="outline" size="sm" className="border-white/15 h-7 ml-auto" onClick={resetPw} data-testid="reset-password-btn"><KeyRound className="w-3.5 h-3.5 mr-1.5" /> Şifre Sıfırla & Gönder</Button>
              </div>

              {/* Courses & progress */}
              <div className="mt-2">
                <h3 className="font-heading font-semibold text-sm mb-2">Kayıtlı Eğitimler & İlerleme</h3>
                <div className="space-y-2">
                  {detail.courses.length === 0 ? <p className="text-sm text-muted-foreground">Kayıtlı kurs yok.</p> : detail.courses.map((c) => (
                    <div key={c.course_id} className="bg-ink rounded-lg p-3">
                      <div className="flex items-center justify-between"><p className="text-sm font-medium">{c.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${c.paid_amount === 0 ? "bg-green-500/15 text-green-400 border-green-500/20" : "bg-gold/15 text-gold border-gold/20"}`} data-testid={`admin-paid-${c.course_id}`}>{c.paid_amount === 0 ? "Ücretsiz" : `${formatPrice(c.paid_amount)} ₺`}</Badge>
                          <Badge className="bg-secondary text-[10px]">{srcLabel(c.source)}</Badge>
                          <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => unenroll(c.course_id)}><Trash2 className="w-3.5 h-3.5" /></Button></div></div>
                      <div className="flex items-center gap-2 mt-2"><Progress value={c.progress_pct} className="h-1.5 flex-1" /><span className="text-xs text-muted-foreground">%{c.progress_pct} ({c.completed_lessons}/{c.lesson_count})</span></div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Select value={courseToAdd} onValueChange={setCourseToAdd}><SelectTrigger className="bg-ink border-white/10 h-9" data-testid="enroll-course-select"><SelectValue placeholder="Kursa ekle..." /></SelectTrigger>
                    <SelectContent>{courses.map((c) => <SelectItem key={c.course_id} value={c.course_id}>{c.title}</SelectItem>)}</SelectContent></Select>
                  <Button onClick={enroll} size="sm" className="bg-gold text-ink font-semibold shrink-0" data-testid="manual-enroll"><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Payments + invoice upload */}
              <div className="mt-4">
                <h3 className="font-heading font-semibold text-sm mb-2">Ödemeler & Fatura</h3>
                <div className="space-y-2">
                  {detail.payments.length === 0 ? <p className="text-sm text-muted-foreground">Ödeme yok.</p> : detail.payments.map((p) => (
                    <div key={p.order_id} className="flex items-center justify-between bg-ink rounded-lg p-3 text-sm">
                      <div><p>{formatPrice(p.total)} ₺ <Badge className="ml-1 text-[10px] bg-secondary">{statusLabel(p.status)}</Badge></p><p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p></div>
                      {p.status === "paid" && (
                        <div className="flex items-center gap-2">
                          <input type="file" accept="application/pdf" className="hidden" ref={(el) => (invRefs.current[p.order_id] = el)} onChange={(e) => uploadInvoice(p.order_id, e.target.files[0])} />
                          {p.has_invoice ? <a href={`${API}/my/invoice/${p.order_id}`} target="_blank" rel="noreferrer" className="text-xs text-gold flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Fatura</a>
                            : <Button variant="outline" size="sm" className="border-white/15 h-7" onClick={() => invRefs.current[p.order_id]?.click()} data-testid={`upload-invoice-${p.order_id}`}><Upload className="w-3.5 h-3.5 mr-1" /> Fatura</Button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Certificate upload */}
              <div className="mt-4">
                <h3 className="font-heading font-semibold text-sm mb-2">Katılım Belgesi Yükle</h3>
                <div className="flex gap-2">
                  <Select value={certCourse} onValueChange={setCertCourse}><SelectTrigger className="bg-ink border-white/10 h-9" data-testid="cert-course-select"><SelectValue placeholder="Kurs seç..." /></SelectTrigger>
                    <SelectContent>{detail.courses.map((c) => <SelectItem key={c.course_id} value={c.course_id}>{c.title}</SelectItem>)}</SelectContent></Select>
                  <input type="file" accept="application/pdf" className="hidden" ref={certRef} onChange={(e) => uploadCert(e.target.files[0])} />
                  <Button onClick={() => certRef.current?.click()} size="sm" variant="outline" className="border-white/15 shrink-0" data-testid="upload-cert-btn"><Award className="w-4 h-4 mr-1.5" /> Yükle</Button>
                </div>
                {detail.certificates.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{detail.certificates.map((c) => <Badge key={c.certificate_id} className="bg-gold/10 text-gold border-gold/20">{c.course_title || c.code}{c.has_file ? " ✓" : ""}</Badge>)}</div>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
