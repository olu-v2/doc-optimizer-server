const { getApiKey, logUsage } = require('../services/dynamoService');

module.exports = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key', code: 'UNAUTHORIZED' });
  }

  const record = await getApiKey(apiKey);

  if (!record || !record.active) {
    return res.status(403).json({ error: 'Invalid or inactive API key', code: 'FORBIDDEN' });
  }

  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return res.status(403).json({
      success: false,
      error: { message: 'API key has expired', code: 'KEY_EXPIRED' },
    });
  }

  req.clientId = record.clientId;
  await logUsage({ clientId: record.clientId, endpoint: req.path, jobId: req.body?.jobId });
  next();
};
