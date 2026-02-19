const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const TABLE = process.env.DYNAMO_TABLE;

exports.createJob = async ({ jobId, key, optimizationLevel }) => {
  await db.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        jobId,
        status: 'CREATED',
        inputKey: key,
        outputKey: `uploads/processed/${jobId}_${optimizationLevel}.pdf`,
        optimizationLevel,
        createdAt: new Date().toISOString(),
      },
    })
  );
};

exports.updateJobStatus = async (jobId, status, extra = {}) => {
  await db.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { jobId },
      UpdateExpression: 'SET #s = :s, updatedAT = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':t': new Date().toISOString(), ...extra },
    })
  );
};

exports.getJob = async jobId => {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { jobId } }));
  return Item;
};

exports.logUsage = async ({ clientId, endpoint, jobId }) => {
  await ddb.send(
    new PutCommand({
      TableName: process.env.DYNAMO_USAGE_TABLE, // separate table: api_usage
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

exports.getApiKey = async apiKey => {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: process.env.DYNAMO_KEYS_TABLE,
      Key: { apiKey },
    })
  );

  return Item;
};
