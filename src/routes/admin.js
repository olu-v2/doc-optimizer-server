import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const express = require('express');
const router = express.Router();

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

router.post('/keys', async (req, res) => {
  const { clientId } = req.body;

  if (!clientId) return res.status(400).json({ error: 'clientId required' });

  const apiKey = `sk_live_${uuidv4().replace(/-/g, '')}`;

  await db.send(
    new PutCommand({
      TableName: process.env.DYNAMO_KEYS_TABLE,
      Item: {
        apiKey,
        clientId,
        active: true,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
  );

  res.status(201).json({ apiKey, clientId });
});

export default router;
