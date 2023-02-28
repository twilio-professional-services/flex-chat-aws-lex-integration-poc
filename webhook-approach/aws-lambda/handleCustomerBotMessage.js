import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const defaultBotIds = {
  botAliasId: process.env.DEFAULT_BOT_ALIAS_ID,
  botId: process.env.DEFAULT_BOT_ID,
};
const queueUrl = process.env.QUEUE_URL;

const botIdsFromBotName = (botName) => {
  // in practice this would map botName to required Ids
  return defaultBotIds;
};

export const handler = async (event) => {
  const config = {
    region: process.env.AWS_REGION,
  };
  console.log(event.body);
  const { customerMessage, botName, sessionId } = JSON.parse(event.body);
  const { botAliasId, botId } = botIdsFromBotName(botName);

  console.log(customerMessage, botName, sessionId);

  const input = {
    MessageAttributes: {
      botAliasId: {
        DataType: "String",
        StringValue: botAliasId,
      },
      botId: {
        DataType: "String",
        StringValue: botId,
      },
      sessionId: {
        DataType: "String",
        StringValue: sessionId,
      },
    },
    MessageBody: customerMessage,
    QueueUrl: queueUrl,
  };

  // add message to SQS queue
  const client = new SQSClient(config);
  const command = new SendMessageCommand(input);
  await client.send(command);

  const response = {
    statusCode: 200,
    body: JSON.stringify(""),
  };
  return response;
};
