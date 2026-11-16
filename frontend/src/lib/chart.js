// Start a new segment after each missing observation.
export function linePath(points) {
  let path = "", open = false;
  for (const point of points) {
    if (point == null) { open = false; continue; }
    const [x, y] = point;
    path += `${open ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    open = true;
  }
  return path;
}

// Preserve the time axis when acquisition intervals are not all the same length.
export function dateFractions(dates) {
  const times = dates.map((date) => Date.parse(date + "T00:00:00Z"));
  const span = times.at(-1) - times[0];
  return times.map((time) => span > 0 ? (time - times[0]) / span : 0);
}
