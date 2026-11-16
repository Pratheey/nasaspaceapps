// Steven's radar-lane results (polarization and NISAR vs Sentinel-1 coverage over 30 fields).
// Files: public/radar/, written by radar/app_export.py. Shape: contracts/radar_app.md.
export const CROP_COLORS = { Alfalfa: "#7FD18B", Almonds: "#F2C46D", Cotton: "#ECE9E2" };

const count = (v, max = Infinity) => Number.isInteger(v) && v >= 0 && v <= max;
const measurement = (v) => v === null || Number.isFinite(v);
const date = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(Date.parse(s + "T00:00:00Z"))
  && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const position = (p) => Array.isArray(p) && p.length >= 2
  && Number.isFinite(p[0]) && Math.abs(p[0]) <= 180 && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90;
const polygon = (rings) => Array.isArray(rings) && rings.length > 0 && rings.every((ring) =>
  Array.isArray(ring) && ring.length >= 4 && ring.every(position)
  && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]);

function validRadar(pol, cov, fields) {
  const dates = pol?.dates, crops = pol?.crops;
  const series = (a) => Array.isArray(a) && a.length === dates.length && a.every(measurement);
  if (!(typeof pol?.is_synthetic === "boolean" && cov?.is_synthetic === pol.is_synthetic
    && count(pol.fields) && pol.fields > 0 && cov.fields === pol.fields && count(pol.measurements)
    && Array.isArray(dates) && dates.length >= 2
    && dates.every((v, k) => date(v) && (!k || v > dates[k - 1]))
    && Array.isArray(crops) && crops.length > 0 && new Set(crops).size === crops.length
    && crops.every((c) => typeof c === "string" && Number.isFinite(pol.median_hv_over_hh_db?.[c])
      && ["hh_db", "hv_db", "hv_over_hh_db"].every((key) => series(pol.series?.[c]?.[key]))
      && Array.isArray(pol.series[c].fields_measured) && pol.series[c].fields_measured.length === dates.length
      && pol.series[c].fields_measured.every((n) => count(n, pol.fields)))
    && Number.isFinite(cov.threshold_median_coherence) && cov.threshold_median_coherence >= 0 && cov.threshold_median_coherence <= 1
    && Array.isArray(cov.pairs) && cov.pairs.length > 0
    && cov.pairs.every((p) => p?.fields === pol.fields && ["nisar", "s1"].every((sensor) =>
      date(p[sensor + "_start"]) && date(p[sensor + "_end"]) && p[sensor + "_end"] > p[sensor + "_start"]
      && count(p[sensor + "_measured"], p.fields) && count(p[sensor + "_usable"], p[sensor + "_measured"])))
    && ["nisar", "s1"].every((sensor) => cov.totals?.[sensor]?.checks === cov.pairs.length * pol.fields
      && cov.totals[sensor].usable === cov.pairs.reduce((sum, p) => sum + p[sensor + "_usable"], 0))
    && fields?.type === "FeatureCollection" && Array.isArray(fields.features) && fields.features.length === pol.fields)) return false;
  const ids = new Set();
  return fields.features.every((f) => {
    const p = f?.properties, g = f?.geometry;
    if (!(f?.type === "Feature" && typeof p?.field_id === "string" && !ids.has(p.field_id)
      && crops.includes(p.crop) && position([p.lon, p.lat]) && Number.isFinite(p.acres) && p.acres > 0
      && measurement(p.hv_over_hh_db_median) && series(p.hv_over_hh_db)
      && p.pairs === cov.pairs.length && count(p.nisar_usable, p.pairs) && count(p.s1_usable, p.pairs)
      && (g?.type === "Polygon" ? polygon(g.coordinates)
        : g?.type === "MultiPolygon" && Array.isArray(g.coordinates) && g.coordinates.length > 0 && g.coordinates.every(polygon)))) return false;
    ids.add(p.field_id);
    return true;
  }) && ["nisar", "s1"].every((sensor) => fields.features.reduce((sum, f) => sum + f.properties[sensor + "_usable"], 0) === cov.totals[sensor].usable);
}

let cache = null;
export function loadRadar() {
  if (!cache) {
    const get = (n) => fetch(`./radar/${n}`).then((r) => {
      // Some static hosts serve GeoJSON as application/octet-stream.
      if (!r.ok) throw new Error(n);
      return r.json();
    });
    cache = Promise.all([get("polarization.json"), get("coverage.json"), get("fields.json")])
      .then(([pol, cov, fields]) => {
        if (!validRadar(pol, cov, fields)) throw new Error("Incomplete radar field dataset");
        return { pol, cov, fields };
      })
      .catch(() => { cache = null; return null; });
  }
  return cache;
}
