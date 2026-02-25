import { getApiKey, logUsage } from '../services/dynamoService.js';
import { error } from '../utils/response.js';

export const authMiddleware = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) return error(res, 'Missing API key', 'UNAUTHORIZED', 401);

  const record = await getApiKey(apiKey);

  if (!record || !record.active) return error(res, 'Invalid or inactive API key', 'FORBIDDEN', 403);

  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return error(res, 'API key has expired', 'KEY_EXPIRED', 403);
  }

  req.clientId = record.clientId;

  try {
    await logUsage({ clientId: record.clientId, endpoint: req.path, jobId: req.body?.jobId });
  } catch (err) {
    console.warn('Failed to log API usage:', err);
  }

  next();
};
