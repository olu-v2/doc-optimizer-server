require('dotenv').config({ override: true });

const {
  AddPermissionCommand,
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  LambdaClient,
  GetFunctionUrlConfigCommand,
  UpdateFunctionCodeCommand,
} = require('@aws-sdk/client-lambda');
const {
  ApiGatewayV2Client,
  CreateApiCommand,
  GetApisCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
} = require('@aws-sdk/client-apigatewayv2');
const fs = require('fs');

const apiClient = new ApiGatewayV2Client({
  region: process.env.AWS_REGION,
});

// allow region, role and function name to be provided via environment variables
const client = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function createLambda() {
  const roleArn = process.env.LAMBDA_ROLE_ARN;

  const functionName = `preview-${process.env.LAMBDA_FUNCTION_NAME}-optimize`;
  const zipFile = fs.readFileSync('./function.zip');

  try {
    const createCommand = new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs22.x',
      Role: roleArn,
      Handler: 'app.handler',
      Code: { ZipFile: zipFile },
      Description: 'Test function',
      Timeout: 30,
      MemorySize: 128,
    });
    const result = await client.send(createCommand);
    console.log('Lambda created', result.FunctionArn);
  } catch (error) {
    if (error.name === 'ResourceConflictException') {
      console.log('⚙️ Function exists — updating code instead...');
      const updateCommand = new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zipFile,
      });
      await client.send(updateCommand);
      console.log('Lambda code updated.');
    } else {
      throw error;
    }
  }

  let functionUrl;
  try {
    const getUrl = await client.send(
      new GetFunctionUrlConfigCommand({ FunctionName: functionName })
    );
    functionUrl = getUrl.FunctionUrl;
    console.log('🔗 Function URL already exists:', functionUrl);
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

  try {
    const permissionCommand = new AddPermissionCommand({
      FunctionName: functionName,
      Action: 'lambda:InvokeFunctionUrl',
      Principal: '*',
      FunctionUrlAuthType: 'NONE',
      StatementId: 'PublicAccess',
    });
    await client.send(permissionCommand);

    await client.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        Action: 'lambda:InvokeFunction',
        Principal: '*',
        StatementId: 'PublicInvokeFunction',
      })
    );
    console.log('Public invoke permission confirmed.');
  } catch (err) {
    if (err.name === 'ResourceConflictException') {
      console.log('Permission already exists.');
    } else {
      throw err;
    }
  }

  const apiName = `preview-api-${process.env.LAMBDA_FUNCTION_NAME}`;

  // 1️⃣ Check if API already exists
  const existingApis = await apiClient.send(new GetApisCommand({}));
  let api = existingApis.Items?.find(a => a.Name === apiName);

  if (!api) {
    console.log('Creating new HTTP API...');

    api = await apiClient.send(
      new CreateApiCommand({
        Name: apiName,
        ProtocolType: 'HTTP',
        CorsConfiguration: {
          AllowOrigins: ['*'],
          AllowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
          AllowHeaders: ['*'],
        },
      })
    );
  } else {
    console.log('API already exists.');
  }

  const integration = await apiClient.send(
    new CreateIntegrationCommand({
      ApiId: api.ApiId,
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:function:${functionName}`,
      PayloadFormatVersion: '2.0',
    })
  );
  await apiClient.send(
    new CreateRouteCommand({
      ApiId: api.ApiId,
      RouteKey: 'ANY /',
      Target: `integrations/${integration.IntegrationId}`,
    })
  );
  await apiClient.send(
    new CreateStageCommand({
      ApiId: api.ApiId,
      StageName: '$default',
      AutoDeploy: true,
    })
  );

  await client.send(
    new AddPermissionCommand({
      FunctionName: functionName,
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      StatementId: `ApiGatewayInvoke-${process.env.LAMBDA_FUNCTION_NAME}`,
    })
  );

  const apiUrl = api.ApiEndpoint;

  console.log('API Gateway URL:', apiUrl);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `function_url=${apiUrl}\n`);
  }
}

createLambda().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
