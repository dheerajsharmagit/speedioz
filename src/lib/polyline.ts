// Decoder for Google's encoded polyline algorithm.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(str: string): { lat: number; lng: number }[] {
  let index = 0;
  const len = str.length;
  const path: { lat: number; lng: number }[] = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}

// Interpolate along a lat/lng path at fraction 0..1. Uses linear segment interpolation.
export function pointAt(path: { lat: number; lng: number }[], t: number): { lat: number; lng: number } {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1 || t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];

  // Cumulative segment lengths (haversine-ish; euclidean on lat/lng is fine for interpolation).
  const lens: number[] = [0];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].lat - path[i - 1].lat;
    const dy = path[i].lng - path[i - 1].lng;
    total += Math.sqrt(dx * dx + dy * dy);
    lens.push(total);
  }
  const target = t * total;
  let seg = 1;
  while (seg < lens.length && lens[seg] < target) seg++;
  if (seg >= lens.length) return path[path.length - 1];
  const segT = (target - lens[seg - 1]) / (lens[seg] - lens[seg - 1] || 1);
  const a = path[seg - 1];
  const b = path[seg];
  return { lat: a.lat + (b.lat - a.lat) * segT, lng: a.lng + (b.lng - a.lng) * segT };
}
