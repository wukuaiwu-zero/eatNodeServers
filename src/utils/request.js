function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key] ?? req.headers?.[key.toLowerCase()];
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
