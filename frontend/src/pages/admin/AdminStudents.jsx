import { useEffect, useState, useRef } from "react";
import { Loader2, Search, BookOpen, Plus, Trash2, KeyRound, Upload, Download, Award, ChevronLeft, ChevronRight } from "lucide-react";
import api, { formatPrice, formatDate, apiError, API } from "@/lib/api";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [courseToAdd, setCourseToAdd] = useState("");
  const [certCourse, setCertCourse] = useState("");
  const invRefs = useRef({});
  const certRef = useRef(null);

  const load = () => { setLoading(true); api.get(`/admin/students?search=${encodeURIComponent(search)}&page=${page}&limit=8`).then(({ data }) => setData(data)).finally(() => setLoading(false)); };
  useEffect(() => { document.title = "Yönetim - Öğrenciler"; api.get("/admin/courses").then(({ data }) => setCourses(data)); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search, page]);

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
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="İsim, e-posta veya telefon ara..." className="pl-11 bg-ink-surface border-white/10 rounded-full h-11" data-testid="student-search" />
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div> : (
        <>
          <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            {data.items.length === 0 ? <p className="text-muted-foreground text-center py-16">Öğrenci bulunamadı.</p> : data.items.map((sdt) => (
              <div key={sdt.user_id} data-testid={`student-${sdt.user_id}`} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors duration-200">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-gold text-ink flex items-center justify-center font-bold shrink-0">{(sdt.name || "?").charAt(0).toUpperCase()}</span>
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{sdt.name}</p><p className="text-xs text-muted-foreground truncate">{sdt.email}{sdt.phone ? ` · ${sdt.phone}` : ""}</p></div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {sdt.enrollment_count}</span>
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
                        <div className="flex items-center gap-2"><Badge className="bg-secondary text-[10px]">{c.source}</Badge><Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => unenroll(c.course_id)}><Trash2 className="w-3.5 h-3.5" /></Button></div></div>
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
                      <div><p>{formatPrice(p.total)} ₺ <Badge className="ml-1 text-[10px] bg-secondary">{p.status}</Badge></p><p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p></div>
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
                <h3 className="font-heading font-semibold text-sm mb-2">Sertifika Yükle</h3>
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
