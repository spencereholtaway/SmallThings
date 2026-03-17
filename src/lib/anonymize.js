import { latLngToCell, cellToLatLng } from 'h3-js';

const H3_RESOLUTION = 6;

export async function anonymizeCoordinates(trueLat, trueLng, uuid) {
  const h3Index = latLngToCell(trueLat, trueLng, H3_RESOLUTION);
  const [hexLat, hexLng] = cellToLatLng(h3Index);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(uuid));
  const bytes = new Uint8Array(hashBuffer);

  const distanceRaw = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  const distanceKm = 1.0 + (distanceRaw / 0xFFFFFFFF) * 2.0;

  const bearingRaw = (bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7]) >>> 0;
  const bearingDeg = (bearingRaw / 0xFFFFFFFF) * 360.0;

  const { lat, lng } = destinationPoint(hexLat, hexLng, distanceKm, bearingDeg);
  return { anonLat: lat, anonLng: lng };
}

function destinationPoint(lat, lng, distanceKm, bearingDeg) {
  const R = 6371;
  const d = distanceKm / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}
