// What each map view shows at a cell, shared by the map, hover, profile and 3D.
import { pairDiff } from "./data.js";

export const MODES = [
  { id: "net", name: "Net change", key: "1" },
  { id: "pair", name: "Two dates", key: "2" },
  { id: "breathe", name: "Breathe", key: "3" },
  { id: "fringe", name: "Radar fringes", key: "4" },
  { id: "labels", name: "What we can say", key: "5" },
];

export function cellValue(D, S, i) {
  switch (S.mode) {
    case "pair": return pairDiff(D, i, S.k1, S.k2);
    case "breathe": return D.values[i]?.[S.cursor] ?? null;
    case "labels": return D.grid.net_change_m[i];
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
  }[S.mode];
}
