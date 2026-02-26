import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createApiKey } from '../services/dynamoService.js';
import express from 'express';
import { success } from '../utils/response.js';

const router = express.Router();

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

router.post('/keys', async (req, res) => {
  const { clientId } = req.body;

  if (!clientId) return res.status(400).json({ error: 'clientId required' });

  const result = await createApiKey({ clientId });

  return success(res, { result }, 201);
});

export default router;
