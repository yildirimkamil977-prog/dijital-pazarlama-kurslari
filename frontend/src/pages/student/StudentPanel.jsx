import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CreditCard, Award, PlayCircle, Loader2, CheckCircle2, Download } from "lucide-react";
import api, { formatPrice, formatDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function StudentPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Öğrenci Paneli - Akademi";
    Promise.all([
      api.get("/my/courses").then(({ data }) => setCourses(data)),
      api.get("/my/payments").then(({ data }) => setPayments(data)),
      api.get("/my/certificates").then(({ data }) => setCerts(data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusBadge = (s) => {
    const map = { paid: ["Ödendi", "bg-green-500/15 text-green-400 border-green-500/20"], pending: ["Bekliyor", "bg-gold/15 text-gold border-gold/20"], failed: ["Başarısız", "bg-destructive/15 text-red-400 border-destructive/20"], token_failed: ["Başarısız", "bg-destructive/15 text-red-400 border-destructive/20"] };
    const [t, c] = map[s] || [s, "bg-secondary"];
    return <Badge className={c}>{t}</Badge>;
  };

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
      <div className="flex items-center gap-4 mb-10">
        <span className="w-14 h-14 rounded-2xl bg-gold text-ink flex items-center justify-center text-2xl font-heading font-black">{(user?.name || "?").charAt(0).toUpperCase()}</span>
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Merhaba, {user?.name}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-ink-surface border border-white/5 rounded-2xl p-5"><BookOpen className="w-5 h-5 text-gold" /><p className="font-heading font-black text-3xl mt-3">{courses.length}</p><p className="text-xs text-muted-foreground">Eğitim</p></div>
        <div className="bg-ink-surface border border-white/5 rounded-2xl p-5"><Award className="w-5 h-5 text-gold" /><p className="font-heading font-black text-3xl mt-3">{certs.length}</p><p className="text-xs text-muted-foreground">Sertifika</p></div>
        <div className="bg-ink-surface border border-white/5 rounded-2xl p-5"><CreditCard className="w-5 h-5 text-gold" /><p className="font-heading font-black text-3xl mt-3">{payments.filter((p) => p.status === "paid").length}</p><p className="text-xs text-muted-foreground">Ödeme</p></div>
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="bg-ink-surface border border-white/5">
          <TabsTrigger value="courses" data-testid="tab-courses">Eğitimlerim</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Ödemelerim</TabsTrigger>
          <TabsTrigger value="certs" data-testid="tab-certs">Sertifikalarım</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-6">
          {courses.length === 0 ? (
            <div className="text-center py-20 bg-ink-surface border border-white/5 rounded-2xl">
              <p className="text-muted-foreground">Henüz bir eğitime kayıtlı değilsin.</p>
              <Link to="/kurslar"><Button className="mt-5 bg-gold text-ink font-semibold rounded-full">Eğitimlere Göz At</Button></Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courses.map((c) => (
                <div key={c.course_id} data-testid={`my-course-${c.course_id}`} className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden flex">
                  <img src={c.thumbnail} alt={c.title} className="w-32 object-cover" />
                  <div className="flex-1 p-5">
                    <h3 className="font-heading font-semibold leading-snug line-clamp-2">{c.title}</h3>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5"><span>%{c.progress_pct} tamamlandı</span><span>{c.completed_lessons}/{c.lesson_count}</span></div>
                      <Progress value={c.progress_pct} className="h-1.5" />
                    </div>
                    <Button onClick={() => navigate(`/panel/izle/${c.course_id}`)} data-testid={`continue-${c.course_id}`} className="mt-4 w-full bg-gold hover:bg-gold-hover text-ink font-semibold h-9">
                      <PlayCircle className="w-4 h-4 mr-2" /> {c.progress_pct > 0 ? "Devam Et" : "Başla"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          {payments.length === 0 ? <p className="text-muted-foreground text-center py-16">Henüz bir ödemen bulunmuyor.</p> : (
            <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
              {payments.map((p) => (
                <div key={p.order_id} className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm font-medium">{p.items?.map((i) => i.title).join(", ")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(p.created_at)} · #{p.order_id}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <span className="font-heading font-bold text-gold">{formatPrice(p.total)} ₺</span>
                    {statusBadge(p.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certs" className="mt-6">
          {certs.length === 0 ? <p className="text-muted-foreground text-center py-16">Bir eğitimi tamamladığında sertifikan burada görünecek.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {certs.map((c) => (
                <div key={c.certificate_id} className="relative bg-gradient-to-br from-gold/15 via-ink-surface to-ink-surface border border-gold/20 rounded-2xl p-6">
                  <Award className="w-8 h-8 text-gold" />
                  <h3 className="mt-4 font-heading font-bold text-lg">{c.course_title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{c.user_name}</p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sertifika Kodu</p><p className="text-sm font-mono">{c.code}</p></div>
                    <span className="text-xs text-muted-foreground">{formatDate(c.issued_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
