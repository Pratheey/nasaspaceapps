import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// The less-used map views, tucked into one "More views" button (same pattern as ToolsMenu).
// Shows the active view's name in place of "More views" when one of these is on.
export default function ViewMenu({ views, active, onPick }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", off);
    window.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", off); window.removeEventListener("keydown", esc, true); };
  }, [open]);
  const cur = views.find((v) => v.id === active);
  const ActiveIcon = cur?.icon;
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title="More views" aria-label={cur ? `More views, current: ${cur.name}` : "More views"}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[14px] transition-colors ${cur ? "text-ink bg-deck-2 font-medium" : open ? "bg-deck-2 text-ink" : "text-mute hover:text-ink hover:bg-deck-2"}`}>
        {ActiveIcon && <ActiveIcon size={15} className="shrink-0" />}
        <span className={cur ? "" : "max-sm:sr-only lg:max-xl:sr-only"}>{cur ? cur.name : "More views"}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-[300px] rounded-lg border border-hair-2 bg-deck p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.5)]">
          {views.map(({ id, name, key, tip, icon: Icon }) => (
            <button key={id} role="menuitemradio" aria-checked={active === id} onClick={() => { onPick(id); setOpen(false); }}
              className={`w-full flex items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-deck-2 ${active === id ? "text-accent-2" : "text-ink"}`}>
              <Icon size={16} className="shrink-0" />
              <span className="flex-1 min-w-0 text-[14px]">{name}{tip && <span className="block text-[12.5px] leading-snug text-mute">{tip}</span>}</span>
              <kbd className="font-mono text-[11px] text-mute border border-hair-2 rounded px-1.5 py-0.5">{key}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
