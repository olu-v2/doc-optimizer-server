import { LambdaClient, DeleteFunctionCommand } from '@aws-sdk/client-lambda';
import dotenv from 'dotenv';

dotenv().config({ override: true });
const client = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function destroyLambda() {
  const functionName = `preview-${process.env.LAMBDA_FUNCTION_NAME}-notely`;
  const deleteCommand = new DeleteFunctionCommand({
    FunctionName: functionName,
  });
  const result = await client.send(deleteCommand);
  console.log('Function deleted', result.FunctionArn);
}

destroyLambda().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
