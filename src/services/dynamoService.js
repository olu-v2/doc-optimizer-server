import dotenv from 'dotenv';
dotenv.config();
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION,
  })
);

const JOBS_TABLE = process.env.DYNAMO_TABLE;
const KEYS_TABLE = process.env.DYNAMO_KEYS_TABLE;
const USAGE_TABLE = process.env.DYNAMO_USAGE_TABLE;

// ─── conversion_jobs ─────────────────────────────────────────────

export const createJob = async ({ jobId, key, optimizationLevel, clientId }) => {
  const now = new Date(); // ← fix: declare now
  const expiresAt = Math.floor(now.getTime() / 1000) + 60 * 60 * 48;

  await ddb.send(
    new PutCommand({
      // ← fix: ddb not db
      TableName: JOBS_TABLE,
      Item: {
        jobId,
        status: 'CREATED',
        inputKey: key,
        outputKey: `uploads/processed/${jobId}_${optimizationLevel}.pdf`,
        optimizationLevel,
        clientId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
      },
    })
  );
};

export const updateJobStatus = async (jobId, status, errorMsg = null) => {
  const hasError = errorMsg !== null;
  await ddb.send(
    new UpdateCommand({
      // ← fix: ddb not db
      TableName: JOBS_TABLE,
      Key: { jobId },
      UpdateExpression: `SET #s = :s, updatedAt = :t${hasError ? ', errorMsg = :e' : ''}`,
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s': status,
        ':t': new Date().toISOString(),
        ...(hasError && { ':e': errorMsg }),
      },
    })
  );
};

export const getJob = async jobId => {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: JOBS_TABLE, // ← fix: was TABLE (undefined)
      Key: { jobId },
    })
  );
  return Item;
};

// ─── api_keys ─────────────────────────────────────────────────────

export const getApiKey = async apiKey => {
  const { Item } = await ddb.send(
    new GetCommand({
      // ← fix: ddb not db
      TableName: KEYS_TABLE,
      Key: { apiKey },
    })
  );
  return Item;
};

export const createApiKey = async ({ clientId }) => {
  const apiKey = `sk_live_${uuidv4().replace(/-/g, '')}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  await ddb.send(
    new PutCommand({
      TableName: KEYS_TABLE,
      Item: { apiKey, clientId, active: true, createdAt, expiresAt },
    })
  );

  return { apiKey, clientId, createdAt, expiresAt };
};

export const deactivateApiKey = async apiKey => {
  await ddb.send(
    new UpdateCommand({
      TableName: KEYS_TABLE,
      Key: { apiKey },
      UpdateExpression: 'SET active = :a',
      ExpressionAttributeValues: { ':a': false },
    })
  );
};

// ─── api_usage ────────────────────────────────────────────────────

export const logUsage = async ({ clientId, endpoint, jobId }) => {
  await ddb.send(
    new PutCommand({
      // ← fix: ddb not db
      TableName: USAGE_TABLE,
      Item: {
        usageId: uuidv4(),
        clientId,
        endpoint,
        jobId: jobId || null,
        timestamp: new Date().toISOString(),
      },
    })
  );
};

export const getUsageByClient = async clientId => {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: USAGE_TABLE,
      IndexName: 'clientId-index',
      KeyConditionExpression: 'clientId = :c',
      ExpressionAttributeValues: { ':c': clientId },
    })
  );
  return Items;
};
