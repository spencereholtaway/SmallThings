import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isMyEntry, getReceiptFor } from '../lib/receipts.js';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const STYLE_URL = `https://api.maptiler.com/maps/aquarelle/style.json?key=${MAPTILER_KEY}`;

// Dominant colors for common emojis
const EMOJI_COLORS = {
  '🌴': '#5a9e6f', '🌊': '#4a90d9', '🌅': '#f4a261', '🌄': '#e76f51',
  '🏔️': '#6b7280', '🌲': '#2d6a4f', '🌸': '#f9a8d4', '🌺': '#ef4444',
  '🌻': '#fbbf24', '🌹': '#dc2626', '🍀': '#22c55e', '🍃': '#4ade80',
  '🍁': '#f97316', '🌾': '#d4a574', '🏖️': '#fde68a', '🏝️': '#34d399',
  '🏞️': '#86efac', '⛰️': '#9ca3af', '🌋': '#dc2626', '🗻': '#93c5fd',
  '🌍': '#3b82f6', '🌎': '#3b82f6', '🌏': '#3b82f6', '🌙': '#fbbf24',
  '⭐': '#fbbf24', '🌟': '#fbbf24', '❄️': '#93c5fd', '🌈': '#a78bfa',
  '⛅': '#94a3b8', '🌤️': '#fbbf24', '🌧️': '#60a5fa', '⛈️': '#6b7280',
  '🌩️': '#fbbf24', '🌪️': '#9ca3af', '🌫️': '#d1d5db', '🌞': '#fbbf24',
  '🍎': '#ef4444', '🍊': '#f97316', '🍋': '#fbbf24', '🍇': '#7c3aed',
  '🍓': '#ef4444', '🍒': '#dc2626', '🥑': '#4d7c0f', '🌮': '#f97316',
  '🍕': '#f97316', '🍦': '#fde68a', '🎵': '#8b5cf6', '🎶': '#8b5cf6',
  '🎸': '#8b5cf6', '🎺': '#f59e0b', '🏠': '#92400e', '🏡': '#4ade80',
  '🏛️': '#e2e8f0', '🚗': '#ef4444', '✈️': '#60a5fa', '🚂': '#ef4444',
  '⛵': '#3b82f6', '🎭': '#7c3aed', '🎨': '#f97316', '📚': '#92400e',
  '💡': '#fbbf24', '🔥': '#f97316', '💧': '#60a5fa', '🌱': '#22c55e',
  '🦋': '#a78bfa', '🐦': '#60a5fa', '🐬': '#38bdf8', '🐘': '#9ca3af',
  '🦁': '#f59e0b', '🐻': '#92400e', '🐼': '#6b7280', '🐸': '#22c55e',
  '🦊': '#f97316', '🐺': '#6b7280', '🐮': '#d1d5db', '🐷': '#fda4af',
  '🐔': '#fbbf24', '🐧': '#3b82f6', '🦅': '#78350f', '🦆': '#22c55e',
  '🦉': '#92400e', '🦚': '#22c55e', '🐙': '#f43f5e', '🦑': '#c084fc',
  '🦀': '#ef4444', '🐠': '#f97316', '🐡': '#7c3aed', '🦈': '#6b7280',
  '💫': '#fbbf24', '🎃': '#f97316', '🎄': '#22c55e', '🎆': '#a78bfa',
  '🎇': '#f97316', '🎋': '#22c55e', '🏔': '#9ca3af', '🌬️': '#93c5fd',
  '🍄': '#f97316', '🌵': '#4d7c0f', '🦜': '#22c55e', '🐊': '#4d7c0f',
  '🦩': '#f9a8d4', '🦋': '#a78bfa', '🐝': '#fbbf24', '🦗': '#4d7c0f',
  '🍂': '#f97316', '🌿': '#22c55e', '☘️': '#22c55e', '🌔': '#fbbf24',
};

function getEmojiColor(emoji) {
  return EMOJI_COLORS[emoji] || '#888888';
}

function createEmojiElement(emoji) {
  const wrapper = document.createElement('div');
  wrapper.className = 'map-marker map-marker--emoji-wrapper';

  const pulse = document.createElement('div');
  pulse.className = 'map-marker-pulse';
  pulse.style.setProperty('--pulse-color', getEmojiColor(emoji));
  pulse.style.animationDelay = `${(Math.random() * 2).toFixed(2)}s`;

  const emojiEl = document.createElement('div');
  emojiEl.className = 'map-marker--emoji';
  emojiEl.textContent = emoji;

  wrapper.appendChild(pulse);
  wrapper.appendChild(emojiEl);
  return wrapper;
}

function createClusterElement(count) {
  const wrapper = document.createElement('div');
  wrapper.className = 'map-marker map-marker--cluster';

  const pulse = document.createElement('div');
  pulse.className = 'map-marker-pulse map-marker-pulse--cluster';
  pulse.style.animationDelay = `${(Math.random() * 2).toFixed(2)}s`;

  const circle = document.createElement('div');
  circle.className = 'map-marker--cluster-circle';
  circle.textContent = count;

  wrapper.appendChild(pulse);
  wrapper.appendChild(circle);
  return wrapper;
}

export default function Map({ entries, filter }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clusterRef = useRef(null); // { index, visible }

  function renderMarkers() {
    const map = mapRef.current;
    if (!map || !clusterRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = map.getBounds();
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const zoom = Math.floor(map.getZoom());
    const { index, visible } = clusterRef.current;
    const clusters = index.getClusters(bbox, zoom);

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;

      if (feature.properties.cluster) {
        const count = feature.properties.point_count;
        const clusterId = feature.properties.cluster_id;

        const el = createClusterElement(count);
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), 20);
          map.flyTo({ center: [lng, lat], zoom: expansionZoom });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.push(marker);
      } else {
        const { idx, emoji, mine } = feature.properties;
        const entry = visible[idx];

        let el;
        if (emoji) {
          el = createEmojiElement(emoji);
        } else {
          el = document.createElement('div');
          el.className = 'map-marker map-marker--dot';
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        if (mine && entry) {
          let note = '';
          try {
            const parsed = JSON.parse(entry.content);
            note = parsed.note || '';
          } catch {}

          const time = new Date(entry.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });

          const popupHTML = `<div class="marker-popup">`
            + `<div class="marker-popup__time">${time}</div>`
            + (note ? `<div class="marker-popup__note">${note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : '')
            + `</div>`;

          const popup = new maplibregl.Popup({
            offset: 20,
            closeButton: false,
            closeOnClick: true,
            className: 'marker-popup-wrapper',
          }).setHTML(popupHTML);

          el.style.cursor = 'pointer';

          el.addEventListener('mouseenter', () => {
            if (!popup.isOpen()) marker.setPopup(popup).togglePopup();
          });
          el.addEventListener('mouseleave', () => {
            if (popup.isOpen()) popup.remove();
          });
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popup.isOpen()) {
              popup.remove();
            } else {
              marker.setPopup(popup).togglePopup();
            }
          });
        }

        markersRef.current.push(marker);
      }
    });
  }

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

    map.on('moveend', renderMarkers);
    map.on('zoomend', renderMarkers);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Rebuild cluster index when entries or filter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visible = filter === 'mine'
      ? entries.filter((e) => isMyEntry(e.id))
      : entries;

    const points = visible.map((entry, idx) => {
      const mine = isMyEntry(entry.id);
      const receipt = mine ? getReceiptFor(entry.id) : null;
      const lat = receipt ? receipt.trueLat : entry.anon_lat;
      const lng = receipt ? receipt.trueLng : entry.anon_lng;

      let emoji = null;
      try {
        const parsed = JSON.parse(entry.content);
        emoji = parsed.emoji || null;
      } catch {}

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { idx, emoji, mine },
      };
    });

    const index = new Supercluster({ radius: 60, maxZoom: 16 });
    index.load(points);
    clusterRef.current = { index, visible };

    renderMarkers();

    // Fit map to bounds
    if (visible.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      visible.forEach((entry) => {
        const mine = isMyEntry(entry.id);
        const receipt = mine ? getReceiptFor(entry.id) : null;
        const lat = receipt ? receipt.trueLat : entry.anon_lat;
        const lng = receipt ? receipt.trueLng : entry.anon_lng;
        bounds.extend([lng, lat]);
      });

      if (visible.length === 1) {
        map.flyTo({ center: bounds.getCenter(), zoom: 14 });
      } else {
        map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
      }
    }
  }, [entries, filter]);

  return <div ref={containerRef} className="map" />;
}
