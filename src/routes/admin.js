// routes/admin.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

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

module.exports = router;
