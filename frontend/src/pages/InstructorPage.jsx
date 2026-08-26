import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, User, BookOpen, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { CourseCard } from "@/components/CourseCard";
import { Seo } from "@/components/Seo";
import { useSite } from "@/context/SiteContext";

export default function InstructorPage() {
  const { slug } = useParams();
  const { settings } = useSite();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/instructors/${slug}`).then(({ data }) => { setData(data); document.title = `${data.name} - Eğitmen`; })
      .catch(() => setData(null)).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!data) return <div className="text-center py-40 text-muted-foreground">Eğitmen bulunamadı.</div>;

  return (
    <div className="relative">
      <Seo title={`${data.name} | ${settings.site_name || "Akademi"}`} description={(data.bio || "").slice(0, 155) || `${data.name} eğitmen profili ve eğitimleri`} image={data.avatar} />

      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/90 to-blue-950/40" />
          <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-gold/15 rounded-full blur-[130px]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <Link to="/kurslar" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors duration-200 mb-8"><ArrowLeft className="w-4 h-4" /> Eğitimlere dön</Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {data.avatar ? (
              <img src={data.avatar} alt={data.name} className="w-28 h-28 rounded-2xl object-cover border-2 border-gold/30 gold-glow" data-testid="instructor-avatar" />
            ) : (
              <span className="w-28 h-28 rounded-2xl bg-gold/10 flex items-center justify-center"><User className="w-12 h-12 text-gold" /></span>
            )}
            <div>
              <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">{data.name}</h1>
              {data.title && <p className="mt-3 text-lg text-gold font-medium">{data.title}</p>}
              <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="w-4 h-4" /> {data.courses?.length || 0} eğitim</p>
            </div>
          </motion.div>
          {data.bio && <p className="mt-8 text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-line" data-testid="instructor-bio">{data.bio}</p>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <h2 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight mb-8">{data.name} eğitimleri</h2>
        {data.courses?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.courses.map((c, i) => <CourseCard key={c.course_id} course={c} index={i} />)}
          </div>
        ) : (
          <p className="text-muted-foreground">Bu eğitmene ait yayında eğitim bulunmuyor.</p>
        )}
      </div>
    </div>
  );
}
