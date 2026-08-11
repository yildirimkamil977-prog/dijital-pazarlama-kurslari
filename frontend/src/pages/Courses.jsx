import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CourseCard } from "@/components/CourseCard";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tümü");

  useEffect(() => {
    document.title = "Kurslar - Akademi";
    api.get("/courses").then(({ data }) => setCourses(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const categories = ["Tümü", ...Array.from(new Set(courses.map((c) => c.category).filter(Boolean)))];
  const filtered = courses.filter((c) =>
    (cat === "Tümü" || c.category === cat) &&
    (c.title.toLowerCase().includes(q.toLowerCase()) || (c.subtitle || "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
      <div className="max-w-2xl">
        <span className="overline text-gold">Tüm Eğitimler</span>
        <h1 className="mt-3 font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">Uzmanlığa giden dersler</h1>
        <p className="mt-4 text-muted-foreground">Dijital pazarlamanın her alanında uygulamalı, güncel içerikler.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mt-10 mb-10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input data-testid="course-search" placeholder="Eğitim ara..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-11 bg-ink-surface border-white/10 rounded-full h-11" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} data-testid={`filter-${c}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${cat === c ? "bg-gold text-ink" : "bg-ink-surface text-muted-foreground hover:text-foreground border border-white/10"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-24">Aradığın kriterlere uygun eğitim bulunamadı.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c, i) => <CourseCard key={c.course_id} course={c} index={i} />)}
        </div>
      )}
    </div>
  );
}
