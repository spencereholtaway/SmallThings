import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isMyEntry, getReceiptFor } from '../lib/receipts.js';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const STYLE_URL = `https://api.maptiler.com/maps/aquarelle/style.json?key=${MAPTILER_KEY}`;

export default function Map({ entries, filter }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-122.4, 37.8],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when entries or filter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter entries
    const visible = filter === 'mine'
      ? entries.filter((e) => isMyEntry(e.id))
      : entries;

    if (visible.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();

    visible.forEach((entry) => {
      const mine = isMyEntry(entry.id);
      const receipt = mine ? getReceiptFor(entry.id) : null;
      const lat = receipt ? receipt.trueLat : entry.anon_lat;
      const lng = receipt ? receipt.trueLng : entry.anon_lng;

      // Parse emoji from content
      let emoji = null;
      try {
        const parsed = JSON.parse(entry.content);
        emoji = parsed.emoji || null;
      } catch {}

      // Create marker element
      const el = document.createElement('div');
      el.className = 'map-marker';
      if (emoji) {
        el.textContent = emoji;
        el.classList.add('map-marker--emoji');
      } else {
        el.classList.add('map-marker--dot');
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([lng, lat]);
    });

    // Fit map to bounds
    if (visible.length === 1) {
      map.flyTo({ center: bounds.getCenter(), zoom: 14 });
    } else {
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
  }, [entries, filter]);

  return <div ref={containerRef} className="map" />;
}
