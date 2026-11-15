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
