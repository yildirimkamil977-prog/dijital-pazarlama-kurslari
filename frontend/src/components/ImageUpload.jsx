import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ImageUpload({ value, onChange, testId, className = "" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Lütfen bir görsel dosyası seçin"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Görsel 5MB'den büyük olamaz"); return; }
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(`${process.env.REACT_APP_BACKEND_URL}${data.url}`);
      toast.success("Görsel yüklendi");
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input type="file" accept="image/*" ref={ref} className="hidden" onChange={(e) => handle(e.target.files[0])} data-testid={testId ? `${testId}-input` : undefined} />
      {value ? (
        <img src={value} alt="" className="w-24 h-16 object-cover rounded-lg border border-white/10 shrink-0" />
      ) : (
        <div className="w-24 h-16 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-muted-foreground shrink-0"><Upload className="w-4 h-4" /></div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="border-white/15" onClick={() => ref.current?.click()} disabled={busy} data-testid={testId}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4 mr-1.5" /> Bilgisayardan Yükle</>}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange("")}><X className="w-4 h-4" /></Button>}
      </div>
    </div>
  );
}
