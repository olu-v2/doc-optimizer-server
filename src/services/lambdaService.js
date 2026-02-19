const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambda = new LambdaClient({
  region: process.env.AWS_REGION,
});

exports.invokeProcessingLambda = async payload => {
  if (!process.env.LAMBDA_NAME) throw new Error('LAMBDA_NAME env variable is not set');

  const command = new InvokeCommand({
    FunctionName: process.env.LAMBDA_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify(payload)),
  });

  await lambda.send(command);
};
