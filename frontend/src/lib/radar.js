// Steven's radar-lane results (polarization and NISAR vs Sentinel-1 coverage over 30 fields).
// Files: public/radar/, written by radar/app_export.py. Shape: contracts/radar_app.md.
export const CROP_COLORS = { Alfalfa: "#7FD18B", Almonds: "#F2C46D", Cotton: "#E6EAF2" };

let cache = null;
export function loadRadar() {
  if (!cache) {
    const get = (n) => fetch(`./radar/${n}`).then((r) => {
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error(n);
      return r.json();
    });
    cache = Promise.all([get("polarization.json"), get("coverage.json"), get("fields.geojson")])
      .then(([pol, cov, fields]) => ({ pol, cov, fields }))
      .catch(() => null);
  }
  return cache;
}
