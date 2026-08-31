import { Instagram, Linkedin, Youtube, Twitter, Facebook, Globe } from "lucide-react";

const TikTok = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.79 4.79 0 0 1-3.34-1.48z" />
  </svg>
);

const PLATFORMS = [
  { key: "instagram", Icon: Instagram, label: "Instagram" },
  { key: "linkedin", Icon: Linkedin, label: "LinkedIn" },
  { key: "youtube", Icon: Youtube, label: "YouTube" },
  { key: "twitter", Icon: Twitter, label: "X" },
  { key: "facebook", Icon: Facebook, label: "Facebook" },
  { key: "tiktok", Icon: TikTok, label: "TikTok" },
  { key: "website", Icon: Globe, label: "Web Sitesi" },
];

export const SOCIAL_KEYS = PLATFORMS.map((p) => p.key);

export function SocialLinks({ links, className = "" }) {
  if (!links) return null;
  const items = PLATFORMS.filter((p) => (links[p.key] || "").trim());
  if (!items.length) return null;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} data-testid="social-links">
      {items.map(({ key, Icon, label }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={label}
          data-testid={`social-${key}`}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-colors duration-200"
        >
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
}
