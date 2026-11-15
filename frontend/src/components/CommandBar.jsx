import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";

/** Ctrl/Cmd+K: type to jump to a place, switch a view or run a tool. */
export default function CommandBar({ open, onClose, items }) {
  const [q, setQ] = useState("");
  const [k, setK] = useState(0);
  const input = useRef(null);
  useEffect(() => { if (open) { setQ(""); setK(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((it) => (it.label + " " + (it.hint || "") + " " + it.group).toLowerCase().includes(t));
  }, [q, items]);
  if (!open) return null;
  const run = (it) => { onClose(); setTimeout(it.run, 0); };
  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm grid place-items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div role="dialog" aria-label="Command bar" onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-w-full rounded-xl border border-hair-2 bg-deck shadow-[0_30px_90px_rgba(0,0,0,.6),0_0_0_1px_rgba(111,168,255,.08)] overflow-hidden [animation:rise-in_.18s_both]">
        <div className="flex items-center gap-3 px-4 border-b border-hair">
          <Search size={17} className="text-accent" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setK(0); }} placeholder="Search places, stations, views and tools"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setK((x) => Math.min(list.length - 1, x + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setK((x) => Math.max(0, x - 1)); }
              else if (e.key === "Enter" && list[k]) run(list[k]);
              else if (e.key === "Escape") onClose();
            }}
            className="flex-1 bg-transparent py-4 text-[16px] outline-none placeholder:text-mute" aria-label="Search" />
          <kbd className="font-mono text-[11px] text-mute border border-hair-2 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto scroll-thin py-2" role="listbox">
          {list.map((it, n) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            const Icon = it.icon;
            return (
              <li key={it.id}>
                {head && <p className="px-4 pt-2 pb-1 text-[11.5px] font-mono text-mute">{head}</p>}
                <button role="option" aria-selected={n === k} onMouseEnter={() => setK(n)} onClick={() => run(it)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14.5px] ${n === k ? "bg-accent/12 text-ink" : "text-ink/85"}`}>
                  {Icon && <Icon size={16} className={n === k ? "text-accent" : "text-mute"} />}
                  <span className="flex-1">{it.label}{it.hint && <span className="text-mute"> {it.hint}</span>}</span>
                  {it.key && <kbd className="font-mono text-[11px] text-mute border border-hair-2 rounded px-1.5">{it.key}</kbd>}
                  {n === k && <CornerDownLeft size={14} className="text-accent" />}
                </button>
              </li>
            );
          })}
          {!list.length && <li className="px-4 py-6 text-mute text-[14px]">Nothing matches. Try a station name, or a view like fringes.</li>}
        </ul>
      </div>
    </div>
  );
}
