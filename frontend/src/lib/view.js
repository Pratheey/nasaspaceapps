// What each map view shows at a cell, shared by the map, hover, profile and 3D.
import { pairDiff } from "./data.js";
import { hiddenSinking } from "./patterns.js";

export const MODES = [
  { id: "net", name: "Net change", key: "1" },
  { id: "pair", name: "Two dates", key: "2" },
  { id: "breathe", name: "Breathe", key: "3" },
  { id: "fringe", name: "Radar fringes", key: "4" },
  { id: "labels", name: "What we can say", key: "5" },
  { id: "hidden", name: "Hidden sinking", key: "6" },
  { id: "patterns", name: "Motion patterns", key: "7" },
];

export function cellValue(D, S, i) {
  switch (S.mode) {
    case "pair": {
      if (S.swipe == null) return pairDiff(D, i, S.k1, S.k2);
      const g = D.meta.grid;
      const lon = g.lon_min + (i % g.ncols + 0.5) * g.step_deg;
      return D.values[i]?.[lon < S.swipe ? S.k1 : S.k2] ?? null;
    }
    case "breathe": return D.values[i]?.[S.cursor] ?? null;
    case "labels": return D.grid.net_change_m[i];
    case "hidden": return hiddenSinking(D).value[i];
    case "patterns": return D.grid.net_change_m[i];
    default: return D.grid.net_change_m[i]; // net, fringe
  }
}

export function netDomain(D) {
  const a = D.grid.net_change_m.filter((v) => v != null).map(Math.abs).sort((x, y) => x - y);
  return Math.max(0.02, a[Math.floor(a.length * 0.98)] || 0.02);
}

export function viewTitle(D, S, fmtShort) {
  const first = fmtShort(D.dates[0]), last = fmtShort(D.dates[D.dates.length - 1]);
  return {
    net: `Change from ${first} to ${last}`,
    pair: `Change from ${fmtShort(D.dates[S.k1])} to ${fmtShort(D.dates[S.k2])}`,
    breathe: `Change from ${first} to ${fmtShort(D.dates[S.cursor])}`,
    fringe: `Change from ${first} to ${last}, as radar fringes`,
    labels: "What we can say at each spot",
    hidden: "Where two dates can hide the sinking",
    patterns: "Spots grouped by the shape of their record",
  }[S.mode];
}
