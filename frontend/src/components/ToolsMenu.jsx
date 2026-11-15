import { useEffect, useRef, useState } from "react";
import { ChevronDown, Wrench, X } from "lucide-react";

// One "Tools" button instead of a row of icons. Active tools show as chips you can switch off.
export default function ToolsMenu({ tools }) {
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
  const active = tools.filter((t) => t.on);
  return (
    <div ref={box} className="relative flex items-stretch border-l border-hair-2">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-[14px] ${open ? "bg-deck-2 text-ink" : "text-ink/90 hover:bg-deck-2"}`}>
        <Wrench size={15} className="shrink-0" /> Tools <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {active.map((t) => (
        <button key={t.label} onClick={t.act} title={`Turn off ${t.label}`}
          className="inline-flex items-center gap-1 border-l border-hair-2 px-2.5 py-2 text-[13px] bg-accent/15 text-accent-2 hover:bg-accent/25 whitespace-nowrap">
          {t.label} <X size={13} />
        </button>
      ))}
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-2 z-30 w-[290px] rounded-lg border border-hair-2 bg-deck p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.5)]">
          {tools.map(({ icon: Icon, label, hint, on, act, key }) => (
            <button key={label} role="menuitemcheckbox" aria-checked={!!on} onClick={() => { act(); setOpen(false); }}
              className={`w-full flex items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-deck-2 ${on ? "text-accent-2" : "text-ink"}`}>
              <Icon size={16} className="shrink-0 mt-0.5" />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px]">{label}{on ? " (on)" : ""}</span>
                {hint && <span className="block text-[12.5px] text-mute leading-snug">{hint}</span>}
              </span>
              {key && <kbd className="font-mono text-[11px] text-mute border border-hair-2 rounded px-1.5 py-0.5">{key}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
