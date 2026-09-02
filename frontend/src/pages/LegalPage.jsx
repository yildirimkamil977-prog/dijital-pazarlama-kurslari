import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { FileText, Loader2 } from "lucide-react";

export default function LegalPage() {
  const { type } = useParams();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    api.get(`/legal/${type}`)
      .then(({ data }) => setContent(data))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { document.title = `${content?.title || "Sözleşme"} - Akademi`; }, [content]);

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!content) return <div className="text-center py-40 text-muted-foreground">Sayfa bulunamadı. <Link to="/" className="text-gold">Anasayfa</Link></div>;

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16" data-testid="legal-page">
      <div className="flex items-center gap-3 mb-8">
        <span className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center"><FileText className="w-5 h-5 text-gold" /></span>
        <h1 className="font-heading font-black text-3xl tracking-tighter">{content.title}</h1>
      </div>
      <div
        className="bg-ink-surface border border-white/5 rounded-2xl p-8 text-muted-foreground leading-relaxed text-sm [&_h2]:text-foreground [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:first:mt-0 [&_h3]:text-foreground [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-7 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ul]:space-y-2 [&_li]:pl-1 [&_li]:marker:text-gold [&_strong]:text-foreground [&_strong]:font-semibold [&_a]:text-gold [&_a]:underline [&_a]:break-all"
        data-testid="legal-body"
        dangerouslySetInnerHTML={{ __html: content.body || "" }}
      />
    </div>
  );
}
