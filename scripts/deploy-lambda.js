require('dotenv').config({ override: true });

const {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  LambdaClient,
  GetFunctionUrlConfigCommand,
  UpdateFunctionCodeCommand,
  waitUntilFunctionUpdated,
} = require('@aws-sdk/client-lambda');

const fs = require('fs');

const client = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function createLambda() {
  const roleArn = process.env.LAMBDA_ROLE_ARN;
  const functionName = `preview-${process.env.LAMBDA_FUNCTION_NAME}-optimize`;
  const zipFile = fs.readFileSync('./function.zip');

  // FIX 1: Proper try/catch structure with closing braces
  try {
    const createCommand = new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs22.x',
      Role: roleArn,
      Handler: 'app.handler',
      Code: { ZipFile: zipFile },
      Description: 'Preview deployment function',
      Timeout: 30, // FIX 2: Increased from 10s to 30s for S3/DynamoDB operations
      MemorySize: 128,
    });

    const result = await client.send(createCommand);
    console.log('Lambda created:', result.FunctionArn);
  } catch (error) {
    if (error.name === 'ResourceConflictException') {
      console.log('Function exists — updating code instead...');

      const updateCommand = new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zipFile,
      });

      await client.send(updateCommand);
      console.log('Lambda code updated.');

      // FIX 3: Wait for update to complete before configuring URL to avoid race conditions
      console.log('Waiting for function update to complete...');
      await waitUntilFunctionUpdated({ client, maxWaitTime: 60 }, { FunctionName: functionName });
      console.log('Function update confirmed.');
    } else {
      throw error;
    } // FIX 1: This closing brace was missing in the original
  }

  // URL config logic now correctly sits outside the try/catch block
  let functionUrl;

  try {
    const getUrl = await client.send(
      new GetFunctionUrlConfigCommand({ FunctionName: functionName })
    );
    functionUrl = getUrl.FunctionUrl;
    console.log('Function URL already exists:', functionUrl);
  } catch {
    console.log('Creating new Function URL...');

    const urlCommand = new CreateFunctionUrlConfigCommand({
      FunctionName: functionName,
      AuthType: 'NONE',
      Cors: {
        AllowOrigins: ['*'],
        AllowMethods: ['GET', 'POST'],
      },
    });

    const urlResult = await client.send(urlCommand);
    functionUrl = urlResult.FunctionUrl;
    console.log('New Function URL created:', functionUrl);
  }

  // Add public invoke permission
  try {
    const permissionCommand = new AddPermissionCommand({
      FunctionName: functionName,
      Action: 'lambda:InvokeFunctionUrl',
      Principal: '*',
      FunctionUrlAuthType: 'NONE',
      StatementId: 'PublicAccess',
    });

    await client.send(permissionCommand);
    console.log('Public invoke permission confirmed.');
  } catch (err) {
    if (err.name === 'ResourceConflictException') {
      console.log('Permission already exists.');
    } else {
      throw err;
    }
  }

  console.log('Function ready at:', functionUrl);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `function_url=${functionUrl}\n`);
  }
}

createLambda().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
