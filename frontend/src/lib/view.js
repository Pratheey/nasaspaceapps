// What each map view shows at a cell, shared by the map, hover, profile and 3D.
import { pairDiff } from "./data.js";
import { hiddenSinking } from "./patterns.js";
import { fmtDate } from "./fmt.js";
import { FRINGE_M } from "./colors.js";

export const MODES = [
  { id: "net", name: "Net change", key: "1", tip: "Movement from the first pass to the last." },
  { id: "pair", name: "Two dates", key: "2", tip: "The difference between any two dates." },
  { id: "breathe", name: "Time-lapse", key: "3", tip: "Every pass, played in order." },
  { id: "fringe", name: "Radar fringes", key: "4", tip: "Movement drawn as radar colour bands." },
  { id: "labels", name: "What we can say", key: "5", tip: "Seasonal, sinking, both, or not enough evidence." },
  { id: "hidden", name: "Hidden sinking", key: "6", tip: "Sinking that two dates can miss." },
  { id: "patterns", name: "Motion patterns", key: "7", tip: "Spots that move in the same pattern." },
];

export function cellValue(D, S, i) {
  switch (S.mode) {
    case "pair": return pairDiff(D, i, S.k1, S.k2);
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

// One plain sentence saying what the map is showing right now (top-left of the map).
export function viewCaption(D, S) {
  const N = D.dates.length;
  return {
    net: `How far each spot moved between ${fmtDate(D.dates[0])} and ${fmtDate(D.dates[N - 1])}.`,
    pair: `The difference between only two dates, ${fmtDate(D.dates[S.k1])} and ${fmtDate(D.dates[S.k2])}. Drag A and B on the timeline to change them.`,
    breathe: `All ${N} radar passes in order. Press Play, or use the step buttons.`,
    fringe: `The same motion drawn as radar fringes. One full colour cycle is ${(FRINGE_M * 100).toFixed(1)} cm.`,
    labels: "What the data supports at each spot: seasonal movement, sinking, both, or not enough evidence.",
    hidden: "Spots that sank over the whole record, but where some pair of dates at least four months apart shows them rising.",
    patterns: "Spots grouped by the shape of their year of movement; each colour is one shared pattern.",
  }[S.mode];
}

// While a tool is switched on, its instruction replaces the view caption. Cross-section has its own prompt.
export function toolCaption(S, D) {
  if (S.relief) return "Right-drag to turn the view. Height shows the same motion, exaggerated.";
  if (S.fields) return "Click a field to see its radar polarization and coverage.";
  if (S.lens) return "Move the cursor over the map to see radar fringes under it.";
  if (S.profile?.canal) return "Motion along the California Aqueduct is charted below the map.";
  return null;
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
