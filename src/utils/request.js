function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toHeaderKeyVariants(key) {
  const base = String(key || '').trim();

  if (!base) {
    return [];
  }

  const lower = base.toLowerCase();
  const kebab = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  const snake = lower.replace(/-/g, '_');
  const compact = lower.replace(/[-_]/g, '');

  return Array.from(new Set([base, lower, kebab, snake, compact].filter(Boolean)));
}

function getInput(req, key) {
  if (req.body?.[key] !== undefined) {
    return req.body[key];
  }

  if (req.query?.[key] !== undefined) {
    return req.query[key];
  }

  if (req.params?.[key] !== undefined) {
    return req.params[key];
  }

  const headerKeys = toHeaderKeyVariants(key);

  for (const headerKey of headerKeys) {
    if (req.headers?.[headerKey] !== undefined) {
      return req.headers[headerKey];
    }
  }

  return undefined;
}

function getDeviceCredentials(req) {
  return {
    deviceId: normalizeText(getInput(req, 'deviceId') || req.headers['x-device-id']),
    deviceSecret: normalizeText(getInput(req, 'deviceSecret') || req.headers['x-device-secret'])
  };
}

module.exports = {
  normalizeText,
  getInput,
  getDeviceCredentials
};
