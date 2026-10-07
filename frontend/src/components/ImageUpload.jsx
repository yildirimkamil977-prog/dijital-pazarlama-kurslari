import { useRef, useState } from "react";
import { Loader2, Upload, X, Film } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ImageUpload({ value, onChange, testId, className = "", kind = "image" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const isVideo = kind === "video";

  const handle = async (file) => {
    if (!file) return;
    if (!file.type.startsWith(`${kind}/`)) { toast.error(isVideo ? "Lütfen bir video dosyası seçin" : "Lütfen bir görsel dosyası seçin"); return; }
    setBusy(true); setPct(0);
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post(isVideo ? "/admin/upload-video" : "/admin/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => e.total && setPct(Math.round((e.loaded * 100) / e.total)),
      });
      onChange(`${process.env.REACT_APP_BACKEND_URL}${data.url}`);
      toast.success(isVideo ? "Video yüklendi" : "Görsel yüklendi");
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };

  const preview = isVideo
    ? <video src={value} muted playsInline preload="metadata" className="w-16 h-24 object-cover rounded-lg border border-white/10 shrink-0 bg-black" />
    : <img src={value} alt="" className="w-24 h-16 object-cover rounded-lg border border-white/10 shrink-0" />;
  const empty = isVideo ? "w-16 h-24" : "w-24 h-16";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input type="file" accept={`${kind}/*`} ref={ref} className="hidden" onChange={(e) => handle(e.target.files[0])} data-testid={testId ? `${testId}-input` : undefined} />
      {value ? preview : (
        <div className={`${empty} rounded-lg border border-dashed border-white/15 flex items-center justify-center text-muted-foreground shrink-0`}>{isVideo ? <Film className="w-4 h-4" /> : <Upload className="w-4 h-4" />}</div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="border-white/15" onClick={() => ref.current?.click()} disabled={busy} data-testid={testId}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> %{pct}</> : <><Upload className="w-4 h-4 mr-1.5" /> {isVideo ? "Video Yükle" : "Bilgisayardan Yükle"}</>}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange("")}><X className="w-4 h-4" /></Button>}
      </div>
    </div>
  );
}
