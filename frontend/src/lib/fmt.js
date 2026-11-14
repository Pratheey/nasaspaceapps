const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const fmtDate = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const fmtShort = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
export const monthAbbr = (d) => MONTHS[d.getUTCMonth()];

// metres -> "−7.1 cm" (true minus sign, explicit plus)
export function cm(m, digits = 1) {
  if (m == null || !isFinite(m)) return "no value";
  const v = m * 100;
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return `0.${"0".repeat(digits)} cm`;
  return `${v < 0 ? "−" : "+"}${s} cm`;
}
export function mm(m, digits = 1) {
  if (m == null || !isFinite(m)) return "no value";
  return `${(m * 1000).toFixed(digits)} mm`;
}
export function pm(m, unit = "cm", digits = 1) {
  if (m == null || !isFinite(m)) return "";
  const v = unit === "cm" ? m * 100 : m * 1000;
  return `± ${Math.abs(v).toFixed(digits)} ${unit}`;
}
