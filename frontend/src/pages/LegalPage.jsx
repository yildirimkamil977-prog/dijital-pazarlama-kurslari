import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { legalContent } from "@/lib/legal";
import { FileText } from "lucide-react";

export default function LegalPage() {
  const { type } = useParams();
  const content = legalContent[type];
  useEffect(() => { document.title = `${content?.title || "Sözleşme"} - Akademi`; window.scrollTo(0, 0); }, [type, content]);

  if (!content) return <div className="text-center py-40 text-muted-foreground">Sayfa bulunamadı. <Link to="/" className="text-gold">Anasayfa</Link></div>;

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
      <div className="flex items-center gap-3 mb-8">
        <span className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center"><FileText className="w-5 h-5 text-gold" /></span>
        <h1 className="font-heading font-black text-3xl tracking-tighter">{content.title}</h1>
      </div>
      <div className="bg-ink-surface border border-white/5 rounded-2xl p-8 text-muted-foreground leading-relaxed whitespace-pre-line text-sm">
        {content.body}
      </div>
    </div>
  );
}
