import { useEffect, useState } from "react";
import { Loader2, Users, BookOpen, Plus, Trash2 } from "lucide-react";
import api, { formatPrice, formatDate, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [courseToAdd, setCourseToAdd] = useState("");

  const load = () => api.get("/admin/students").then(({ data }) => setStudents(data)).finally(() => setLoading(false));
  useEffect(() => {
    document.title = "Yönetim - Öğrenciler";
    load();
    api.get("/admin/courses").then(({ data }) => setCourses(data));
  }, []);

  const openStudent = async (s) => {
    setSelected(s);
    const { data } = await api.get(`/admin/students/${s.user_id}/enrollments`);
    setEnrollments(data);
  };

  const enroll = async () => {
    if (!courseToAdd) return;
    try {
      await api.post("/admin/enrollments", { user_id: selected.user_id, course_id: courseToAdd });
      toast.success("Öğrenci kursa eklendi");
      const { data } = await api.get(`/admin/students/${selected.user_id}/enrollments`);
      setEnrollments(data); setCourseToAdd(""); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const unenroll = async (course_id) => {
    await api.delete("/admin/enrollments", { data: { user_id: selected.user_id, course_id } });
    toast.success("Kayıt kaldırıldı");
    const { data } = await api.get(`/admin/students/${selected.user_id}/enrollments`);
    setEnrollments(data); load();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter mb-8">Öğrenciler</h1>
      <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
        {students.length === 0 ? <p className="text-muted-foreground text-center py-16">Henüz öğrenci yok.</p> : (
          <div className="divide-y divide-white/5">
            {students.map((s) => (
              <div key={s.user_id} data-testid={`student-${s.user_id}`} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-gold text-ink flex items-center justify-center font-bold">{(s.name || "?").charAt(0).toUpperCase()}</span>
                  <div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {s.enrollment_count} kurs</span>
                  <span className="text-sm font-heading font-bold text-gold">{formatPrice(s.total_spent)} ₺</span>
                  <Button variant="outline" size="sm" className="border-white/15" onClick={() => openStudent(s)} data-testid={`manage-student-${s.user_id}`}>Yönet</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-ink-surface border-white/10">
          <DialogHeader><DialogTitle>{selected?.name} · Kayıtlar</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {enrollments.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Kayıtlı kurs yok.</p> : enrollments.map((e) => (
              <div key={e.course_id} className="flex items-center justify-between bg-ink rounded-lg p-3">
                <div><p className="text-sm">{e.course_title}</p><Badge className="text-[10px] mt-1 bg-secondary">{e.source}</Badge></div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => unenroll(e.course_id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Select value={courseToAdd} onValueChange={setCourseToAdd}>
              <SelectTrigger className="bg-ink border-white/10" data-testid="enroll-course-select"><SelectValue placeholder="Kurs seç..." /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.course_id} value={c.course_id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={enroll} className="bg-gold text-ink font-semibold shrink-0" data-testid="manual-enroll"><Plus className="w-4 h-4 mr-1" /> Kursa Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
