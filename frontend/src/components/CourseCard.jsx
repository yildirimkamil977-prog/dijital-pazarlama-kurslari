import { Link } from "react-router-dom";
import { PlayCircle, Clock, Layers } from "lucide-react";
import { formatPrice, formatDuration } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export function CourseCard({ course, index = 0 }) {
  const hasDiscount = course.discount_price != null && course.discount_price < course.price;
  const isFree = (hasDiscount ? course.discount_price : course.price) === 0;
  return (
    <Link
      to={`/kurslar/${course.slug}`}
      data-testid={`course-card-${course.slug}`}
      className="group relative flex flex-col bg-ink-surface border border-white/5 rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-white/15 transition-transform duration-300 ease-out animate-fade-up"
      style={{ animationDelay: `${index * 70}ms`, opacity: 0 }}
    >
      <div className="relative aspect-video overflow-hidden bg-ink-elevated">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.title} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><PlayCircle className="w-10 h-10 text-muted-foreground" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-surface via-transparent to-transparent opacity-60" />
        {isFree ? (
          <Badge className="absolute top-3 left-3 bg-green-500 text-white font-bold border-0 shadow-lg text-[11px]">Ücretsiz</Badge>
        ) : course.category && (
          <Badge className="absolute top-3 left-3 bg-ink/80 backdrop-blur text-foreground border-white/10 text-[11px]">{course.category}</Badge>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5">
        <h3 className="font-heading font-semibold text-base leading-snug tracking-tight text-foreground group-hover:text-gold transition-colors duration-200 line-clamp-2">
          {course.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 flex-1">{course.subtitle}</p>

        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {course.lesson_count} ders</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatDuration(course.total_seconds)}</span>
        </div>

        <div className="flex items-end justify-between mt-4 pt-4 border-t border-white/5">
          <div>
            {hasDiscount && <span className="text-xs text-muted-foreground line-through mr-2">{formatPrice(course.price)} ₺</span>}
            <span className="font-heading font-bold text-lg text-gold">
              {course.discount_price === 0 || course.price === 0 ? "Ücretsiz" : `${formatPrice(hasDiscount ? course.discount_price : course.price)} ₺`}
            </span>
          </div>
          <span className="text-xs font-medium text-foreground/70 group-hover:text-gold transition-colors duration-200">İncele →</span>
        </div>
      </div>
    </Link>
  );
}
