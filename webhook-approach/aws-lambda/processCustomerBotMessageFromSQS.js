import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} from "@aws-sdk/client-lex-runtime-v2";
import axios from "axios";

const config = {
  region: process.env.AWS_REGION,
};

const parseCustomerBotMesssageFromSQS = (message) => {
  const customerBotMessage = {
    body: message.body,
    botAliasId: message.messageAttributes.botAliasId.stringValue,
    botId: message.messageAttributes.botId.stringValue,
    sessionId: message.messageAttributes.sessionId.stringValue,
  };

  console.log(customerBotMessage);
  return customerBotMessage;
};

const buildRecognizeCommand = (text, sessionId, botAliasId, botId) => {
  return {
    botAliasId,
    botId,
    localeId: "en_US",
    text,
    sessionId,
  };
};

const postBotReply = async (botReply) => {
  const twilioOutboundChatEndpoint = process.env.TWILIO_OUTBOUND_CHAT_ENDPOINT;
  try {
    await axios.post(twilioOutboundChatEndpoint, botReply);
  } catch (error) {
    console.error(error);
  }
};

export const handler = async (event) => {
  console.log("running", event);
  const messages = event.Records;
  // sqs configured for 1 message per trigger
  const message = messages[0];
  if (message) {
    try {
      const { body, botAliasId, botId, sessionId } =
        parseCustomerBotMesssageFromSQS(message);

      console.log(body, botAliasId, botId, sessionId);

      const client = new LexRuntimeV2Client(config);
      const recognizeTextCommand = new RecognizeTextCommand(
        buildRecognizeCommand(body, sessionId, botAliasId, botId)
      );
      const recognizeResponse = await client.send(recognizeTextCommand);

      const intent = recognizeResponse.sessionState?.intent?.name;
      const botReplyMessage = recognizeResponse.messages?.[0]?.content;
      const state = recognizeResponse.sessionState?.intent?.state;
      const slots = recognizeResponse.sessionState?.intent?.slots;

      let botReply = {
        sessionId,
        botReplyMessage,
        nextStep: "WAIT_FOR_MESSAGE",
      };

      // real world this would use a router function for bot specific handling of intent -> nextStep mapping
      switch (intent) {
        case "Agent":
          botReply.nextStep = "AGENT";
          break;

        case "OrderFlowers":
          if (state === "ReadyForFulfillment") {
            console.log("OrderFlowers - ReadyForFulfillment", slots);
            botReply.nextStep = "CLOSE_CHAT";
          }
          break;

        default:
          // send reply and wait for next message
          break;
      }

      console.log(intent, botReply);

      await postBotReply(botReply);
    } catch (error) {
      console.error(error);
    }
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("done"),
  };
  console.log("returning", response);
  return response;
};
