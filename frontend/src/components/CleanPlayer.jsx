import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { toEmbed, isDirectVideo } from "@/lib/video";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const YT_PARAMS = "autoplay=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1&showinfo=0&cc_load_policy=0&enablejsapi=1";
const VIMEO_PARAMS = "autoplay=1&controls=0&keyboard=0";

function buildSrc(url) {
  const src = toEmbed(url);
  const sep = src.includes("?") ? "&" : "?";
  if (src.includes("youtube.com")) return { src: `${src}${sep}${YT_PARAMS}&origin=${encodeURIComponent(window.location.origin)}`, kind: "yt" };
  if (src.includes("vimeo.com")) return { src: `${src}${sep}${VIMEO_PARAMS}`, kind: "vimeo" };
  return { src: `${src}${sep}autoplay=1`, kind: "other" };
}

// Distraction-free player: hides provider controls behind an overlay with a single play/pause button.
export function CleanPlayer({ url, title = "Video", testId = "clean-player" }) {
  const frame = useRef(null);
  const video = useRef(null);
  const [playing, setPlaying] = useState(true);
  const direct = isDirectVideo(url);
  const { src, kind } = direct ? { src: url, kind: "direct" } : buildSrc(url);

  const send = (cmd) => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    if (kind === "yt") w.postMessage(JSON.stringify({ event: "command", func: cmd === "play" ? "playVideo" : "pauseVideo", args: [] }), "*");
    if (kind === "vimeo") w.postMessage(JSON.stringify({ method: cmd }), "*");
  };

  useEffect(() => {
    const onMsg = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      let d = e.data;
      try { if (typeof d === "string") d = JSON.parse(d); } catch { return; }
      if (kind === "yt" && d?.info?.playerState !== undefined) setPlaying(d.info.playerState === 1 || d.info.playerState === 3);
      if (kind === "vimeo" && ["play", "playing"].includes(d?.event)) setPlaying(true);
      if (kind === "vimeo" && ["pause", "ended"].includes(d?.event)) setPlaying(false);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [kind]);

  const onLoad = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    if (kind === "yt") w.postMessage(JSON.stringify({ event: "listening", id: testId }), "*");
    if (kind === "vimeo") ["play", "pause", "ended"].forEach((ev) => w.postMessage(JSON.stringify({ method: "addEventListener", value: ev }), "*"));
  };

  const toggle = () => {
    const next = !playing;
    if (direct) { next ? video.current?.play() : video.current?.pause(); } else send(next ? "play" : "pause");
    setPlaying(next);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden" data-testid={testId}>
      {direct ? (
        <video ref={video} src={src} autoPlay playsInline className="w-full h-full" onEnded={() => setPlaying(false)} />
      ) : (
        <iframe ref={frame} title={title} src={src} onLoad={onLoad} className="w-full h-full pointer-events-none" allow="autoplay; encrypted-media" data-testid={`${testId}-iframe`} />
      )}
      <button type="button" onClick={toggle} aria-label={playing ? "Durdur" : "Oynat"} className="absolute inset-0 flex items-center justify-center group/cp" data-testid={`${testId}-toggle`}>
        <span className={`w-20 h-20 rounded-full bg-gold text-ink flex items-center justify-center shadow-2xl transition-[opacity,transform] duration-300 ${playing ? "opacity-0 group-hover/cp:opacity-90 scale-90" : "opacity-100 scale-100"}`}>
          {playing ? <Pause className="w-9 h-9" /> : <Play className="w-9 h-9 ml-1" />}
        </span>
      </button>
    </div>
  );
}

export function VideoDialog({ url, open, onOpenChange, vertical = false, title = "Video", testId = "video-dialog" }) {
  const size = vertical ? { width: "min(420px, calc(88vh * 9 / 16), 92vw)" } : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={size} className={`${vertical ? "" : "max-w-4xl"} p-0 gap-0 bg-black border-white/10 overflow-hidden`} data-testid={testId}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className={vertical ? "aspect-[9/16]" : "aspect-video"}>{open && url && <CleanPlayer url={url} title={title} testId={`${testId}-player`} />}</div>
      </DialogContent>
    </Dialog>
  );
}
