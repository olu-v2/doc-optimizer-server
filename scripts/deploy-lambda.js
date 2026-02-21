// scripts/deploy-lambda.js
require('dotenv').config({ override: true });

const fs = require('fs');
const {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  AddPermissionCommand,
  GetFunctionUrlConfigCommand,
  CreateFunctionUrlConfigCommand,
} = require('@aws-sdk/client-lambda');

const {
  ApiGatewayV2Client,
  CreateApiCommand,
  GetApisCommand,
  GetIntegrationsCommand,
  GetRoutesCommand,
  GetStagesCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
} = require('@aws-sdk/client-apigatewayv2');

const client = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const apiClient = new ApiGatewayV2Client({ region: process.env.AWS_REGION });

async function createLambda() {
  const functionName = `preview-${process.env.LAMBDA_FUNCTION_NAME}-optimize`;
  const zipFile = fs.readFileSync('./function.zip');
  const roleArn = process.env.LAMBDA_ROLE_ARN;

  try {
    await client.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: 'nodejs22.x',
        Role: roleArn,
        Handler: 'app.handler',
        Code: { ZipFile: zipFile },
        Description: 'Preview Lambda function',
        Timeout: 30,
        MemorySize: 128,
      })
    );
    console.log(`Lambda function created: ${functionName}`);
  } catch (err) {
    if (err.name === 'ResourceConflictException') {
      console.log(`Lambda exists, updating code: ${functionName}`);
      await client.send(
        new UpdateFunctionCodeCommand({ FunctionName: functionName, ZipFile: zipFile })
      );
      console.log('Lambda code updated.');
    } else {
      throw err;
    }
  }

  const lambdaPermissions = [
    {
      Action: 'lambda:InvokeFunctionUrl',
      Principal: '*',
      StatementId: 'PublicAccess',
      FunctionUrlAuthType: 'NONE',
    },
    {
      Action: 'lambda:InvokeFunction',
      Principal: '*',
      StatementId: `PublicInvokeFunction`,
    },
  ];

  for (const perm of lambdaPermissions) {
    try {
      await client.send(new AddPermissionCommand({ FunctionName: functionName, ...perm }));
      console.log(`Permission added: ${perm.StatementId}`);
    } catch (err) {
      if (err.name === 'ResourceConflictException') {
        console.log(`Permission already exists: ${perm.StatementId}`);
      } else {
        throw err;
      }
    }
  }

  const apiName = `preview-api-${process.env.LAMBDA_FUNCTION_NAME}`;
  const existingApis = await apiClient.send(new GetApisCommand({}));
  let api = existingApis.Items?.find(a => a.Name === apiName);

  if (!api) {
    console.log(`Creating new HTTP API: ${apiName}`);
    api = await apiClient.send(
      new CreateApiCommand({
        Name: apiName,
        ProtocolType: 'HTTP',
        CorsConfiguration: {
          AllowOrigins: ['*'],
          AllowMethods: ['GET', 'POST', 'PUT', 'OPTIONS', 'DELETE', 'PATCH'],
          AllowHeaders: ['*'],
        },
      })
    );
  } else {
    console.log(`API already exists: ${apiName}`);
  }

  const integrations = await apiClient.send(new GetIntegrationsCommand({ ApiId: api.ApiId }));
  let integration = integrations.Items?.find(i => i.IntegrationUri?.includes(functionName));

  if (!integration) {
    console.log('Creating Lambda integration...');
    integration = await apiClient.send(
      new CreateIntegrationCommand({
        ApiId: api.ApiId,
        IntegrationType: 'AWS_PROXY',
        IntegrationUri: `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:function:${functionName}`,
        PayloadFormatVersion: '2.0',
      })
    );
  } else {
    console.log('Integration already exists.');
  }

  const routes = await apiClient.send(new GetRoutesCommand({ ApiId: api.ApiId }));
  let route = routes.Items?.find(r => r.RouteKey === 'ANY /');

  if (!route) {
    console.log('⚙️ Creating route ANY /');
    await apiClient.send(
      new CreateRouteCommand({
        ApiId: api.ApiId,
        RouteKey: 'ANY /',
        Target: `integrations/${integration.IntegrationId}`,
      })
    );
  } else {
    console.log('Route already exists.');
  }

  const stages = await apiClient.send(new GetStagesCommand({ ApiId: api.ApiId }));
  let stage = stages.Items?.find(s => s.StageName === '$default');

  if (!stage) {
    console.log('⚙️ Creating stage $default');
    await apiClient.send(
      new CreateStageCommand({
        ApiId: api.ApiId,
        StageName: '$default',
        AutoDeploy: true,
      })
    );
  } else {
    console.log('Stage already exists.');
  }

  try {
    await client.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        StatementId: `ApiGatewayInvoke-${process.env.LAMBDA_FUNCTION_NAME}`,
      })
    );
    console.log('API Gateway invoke permission added.');
  } catch (err) {
    if (err.name === 'ResourceConflictException') {
      console.log('API Gateway invoke permission already exists.');
    } else {
      throw err;
    }
  }

  // ─── 8️⃣ Output URL ─────────────────────────────
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
