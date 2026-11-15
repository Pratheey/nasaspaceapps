// Steven's radar-lane results (polarization and NISAR vs Sentinel-1 coverage over 30 fields).
// Files: public/radar/, written by radar/app_export.py. Shape: contracts/radar_app.md.
export const CROP_COLORS = { Alfalfa: "#7FD18B", Almonds: "#F2C46D", Cotton: "#EDE6DA" };

let cache = null;
export function loadRadar() {
  if (!cache) {
    const get = (n) => fetch(`./radar/${n}`).then((r) => {
      // Some static hosts serve GeoJSON as application/octet-stream.
      if (!r.ok) throw new Error(n);
      return r.json();
    });
    cache = Promise.all([get("polarization.json"), get("coverage.json"), get("fields.json")])
      .then(([pol, cov, fields]) => ({ pol, cov, fields }))
      .catch(() => { cache = null; return null; });
  }
  return cache;
}
