import { useState } from "react";
import { Play } from "lucide-react";
import { VideoDialog } from "@/components/CleanPlayer";

export const ReviewMedia = ({ review, testId }) => {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  if (!review.video_url && !review.thumbnail) return null;
  return (
    <>
      <div className={`relative aspect-[9/16] bg-gradient-to-br from-ink-elevated to-ink overflow-hidden group ${review.video_url ? "cursor-pointer" : ""}`} onClick={() => review.video_url && setOpen(true)} data-testid={`${testId}-media`}>
        {review.thumbnail && imgOk && <img src={review.thumbnail} alt={review.name} loading="lazy" onError={() => setImgOk(false)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        {(!review.thumbnail || !imgOk) && <div className="absolute inset-0 flex items-center justify-center font-heading font-black text-5xl text-gold/30">{(review.name || "?").charAt(0)}</div>}
        {review.video_url && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-gold text-ink flex items-center justify-center shadow-xl transition-transform duration-300 group-hover:scale-110" data-testid={`${testId}-play`}><Play className="w-6 h-6 ml-0.5" fill="currentColor" /></span>
          </div>
        )}
      </div>
      {review.video_url && <VideoDialog url={review.video_url} open={open} onOpenChange={setOpen} vertical title={review.name} testId={`${testId}-dialog`} />}
    </>
  );
};
