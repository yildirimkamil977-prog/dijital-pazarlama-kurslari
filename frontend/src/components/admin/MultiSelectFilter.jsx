import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export const MultiSelectFilter = ({ label, options, value, onChange, testId }) => {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-testid={testId} className={`h-10 px-4 rounded-full border text-sm flex items-center gap-2 transition-colors duration-200 ${value.length ? "border-gold/50 text-gold bg-gold/10" : "border-white/10 bg-ink-surface text-muted-foreground hover:text-foreground"}`}>
          {label}{value.length > 0 && <span className="bg-gold text-ink rounded-full text-[10px] font-bold px-1.5">{value.length}</span>}
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 bg-ink-surface border-white/10" align="start">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {options.length === 0 ? <p className="text-xs text-muted-foreground p-2">Kayıt yok.</p> : options.map((o) => (
            <label key={o.id} data-testid={`${testId}-option-${o.id}`} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-secondary/40 cursor-pointer text-sm">
              <Checkbox checked={value.includes(o.id)} onCheckedChange={() => toggle(o.id)} className="mt-0.5" />
              <span className="leading-snug">{o.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} data-testid={`${testId}-clear`} className="mt-1 w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1.5 border-t border-white/5">
            <X className="w-3 h-3" /> Seçimi temizle
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
