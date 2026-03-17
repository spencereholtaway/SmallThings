const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_CONTENT_LENGTH = 10_000;

export function validateEntry(body) {
  const errors = [];

  if (!body.id || !UUID_V4_REGEX.test(body.id)) {
    errors.push('id must be a valid UUID v4');
  }

  if (typeof body.anon_lat !== 'number' || body.anon_lat < -90 || body.anon_lat > 90) {
    errors.push('anon_lat must be a number between -90 and 90');
  }

  if (typeof body.anon_lng !== 'number' || body.anon_lng < -180 || body.anon_lng > 180) {
    errors.push('anon_lng must be a number between -180 and 180');
  }

  if (typeof body.content !== 'string' || body.content.length === 0) {
    errors.push('content must be a non-empty string');
  } else if (body.content.length > MAX_CONTENT_LENGTH) {
    errors.push(`content must be at most ${MAX_CONTENT_LENGTH} characters`);
  }

  if (!body.created_at) {
    errors.push('created_at is required');
  } else {
    const ts = Date.parse(body.created_at);
    if (isNaN(ts)) {
      errors.push('created_at must be a valid ISO 8601 timestamp');
    } else if (ts > Date.now() + CLOCK_SKEW_MS) {
      errors.push('created_at must not be in the future (5 minute tolerance)');
    }
  }

  return errors;
}

export function validateUuid(id) {
  return UUID_V4_REGEX.test(id);
}

export function parseBbox(bboxStr) {
  if (!bboxStr) return null;
  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLat, minLng, maxLat, maxLng] = parts;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat > maxLat || minLng > maxLng) return null;
  return { minLat, minLng, maxLat, maxLng };
}
