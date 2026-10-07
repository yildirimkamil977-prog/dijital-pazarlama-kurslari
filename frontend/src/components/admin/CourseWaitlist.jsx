import { useEffect, useState } from "react";
import { BellRing, Download } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

export const CourseWaitlist = ({ courseId }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => { if (courseId) api.get(`/admin/courses/${courseId}/waitlist`).then(({ data }) => setRows(data)).catch(() => {}); }, [courseId]);
  const exportCsv = () => {
    const csv = "\ufeffAd;E-posta;Tarih\n" + rows.map((r) => [r.name || "", r.email, (r.created_at || "").slice(0, 16).replace("T", " ")].join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "haber-ver-listesi.csv"; a.click();
  };
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-ink p-4" data-testid="course-waitlist">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-2"><BellRing className="w-4 h-4 text-gold" /> "Açılınca haber ver" listesi <span className="text-gold" data-testid="waitlist-count">({rows.length})</span></p>
        {rows.length > 0 && <Button size="sm" variant="outline" className="border-white/15 h-8" onClick={exportCsv} data-testid="waitlist-export"><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button>}
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground mt-2">Henüz kayıt yok.</p> : (
        <div className="mt-3 max-h-48 overflow-y-auto divide-y divide-white/5 text-sm">
          {rows.map((r) => <div key={r.email} className="flex justify-between gap-3 py-1.5"><span className="truncate">{r.name ? `${r.name} · ` : ""}{r.email}</span><span className="text-xs text-muted-foreground shrink-0">{(r.created_at || "").slice(0, 10)}</span></div>)}
        </div>
      )}
    </div>
  );
};
