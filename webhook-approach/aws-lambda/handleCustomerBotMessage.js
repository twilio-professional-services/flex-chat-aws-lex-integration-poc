import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Temporary hard coded values for POC
const OrderFlowersBotIds = { botAliasId: "TSTALIASID", botId: "ZHHHA7H8FQ" };
const queueUrl =
  "https://sqs.us-east-1.amazonaws.com/658438689449/inboundCustomerBotMessages";

const botIdsFromBotName = (botName) => {
  // in practice this would map botName to required Ids
  return OrderFlowersBotIds;
};

export const handler = async (event) => {
  const config = {
    region: "us-east-1",
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
  const sqsResponse = await client.send(command);

  const response = {
    statusCode: 200,
    body: JSON.stringify(""),
  };
  return response;
};
