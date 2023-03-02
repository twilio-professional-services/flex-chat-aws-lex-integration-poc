import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} from "@aws-sdk/client-lex-runtime-v2";
import twilio from "twilio";

const config = {
  region: process.env.AWS_REGION,
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

const isRequestFromTwilio = (url, body, requestHeader) => {
  const xTwilioSignature = requestHeader["X-Twilio-Signature"];
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    xTwilioSignature,
    url,
    body
  );
};

const sendMessageToLex = async (Body, ConversationSid, BotAliasId, BotId) => {
  const client = new LexRuntimeV2Client(config);
  const recognizeTextCommand = new RecognizeTextCommand(
    buildRecognizeCommand(Body, ConversationSid, BotAliasId, BotId)
  );
  return await client.send(recognizeTextCommand);
};

const botReplyMessageFromLexResponse = (recognizeResponse) => {
  return recognizeResponse.messages?.[0]?.content;
};

const intentFromLexResponse = (recognizeResponse) => {
  return recognizeResponse.sessionState?.intent?.name;
};

const isOrderFullfilledFromLextResponse = (recognizeResponse) => {
  const state = recognizeResponse.sessionState?.intent?.state;
  return state === "ReadyForFulfillment";
};

const closeConversation = async (accountSid, conversationSid) => {
  const twilioClient = twilio(accountSid, process.env.TWILIO_AUTH_TOKEN);

  await twilioClient.conversations.v1
    .conversations(conversationSid)
    .update({ state: "closed" });
};

const addMessageToConversation = async (
  accountSid,
  conversationSid,
  body,
  author
) => {
  const twilioClient = twilio(accountSid, process.env.TWILIO_AUTH_TOKEN);

  await twilioClient.conversations.v1
    .conversations(conversationSid)
    .messages.create({ author, body });
};

const sendToFlex = async (
  accountSid,
  conversationSid,
  botId,
  from,
  webhookSid
) => {
  const twilioClient = twilio(accountSid, process.env.TWILIO_AUTH_TOKEN);

  await twilioClient.conversations.v1
    .conversations(conversationSid)
    .webhooks(webhookSid)
    .remove();

  // TODO - revisit and handle webchat and other channels
  // create an interaction to send to Flex via TaskRouter
  // for POC purposes just add the BotId to the attributes so it could be used for routing
  await twilioClient.flexApi.v1.interaction.create({
    channel: {
      type: "sms",
      initiated_by: "customer",
      properties: { media_channel_sid: conversationSid },
    },
    routing: {
      properties: {
        workspace_sid: process.env.FLEX_WORKSPACE_SID,
        workflow_sid: process.env.FLEX_WORKFLOW_SID,
        task_channel_unique_name: "sms",
        attributes: {
          from,
          botId,
        },
      },
    },
  });
};

export const handler = async (event) => {
  const { request, ...eventWebhookPayload } = event;
  const { BotId, BotAliasId } = event.request.querystring;
  const { ConversationSid, AccountSid, EventType, Body, Author, WebhookSid } =
    eventWebhookPayload;

  if (!BotId || !BotAliasId) {
    console.warn("Missing BotId and/or BotAliasId");
    return;
  }

  if (
    EventType !== "onMessageAdded" ||
    !ConversationSid ||
    !AccountSid ||
    !Body
  ) {
    console.warn("Invalid webhook payload - giving up");
    return;
  }

  const conversationAddressWebhookUrl = `https://${request.domainName}${request.requestPath}?BotId=${BotId}&BotAliasId=${BotAliasId}`;
  if (
    !isRequestFromTwilio(
      conversationAddressWebhookUrl,
      eventWebhookPayload,
      request.header
    )
  ) {
    console.warn(
      "X-Twilio-Signature mismatch - check conversationAddressWebhookUrl is correct. We are assuming the configured url is:",
      conversationAddressWebhookUrl
    );
    return;
  }

  const recognizeResponse = await sendMessageToLex(
    Body,
    ConversationSid,
    BotAliasId,
    BotId
  );

  const botReplyMessage = botReplyMessageFromLexResponse(recognizeResponse);

  if (botReplyMessage) {
    await addMessageToConversation(
      AccountSid,
      ConversationSid,
      botReplyMessage,
      "Lex"
    );
  }

  // for simplicty we are handling lex responses here and not even checking which bot id we are working with
  // In a real world scenario you may want to have a function router here for each bot
  // or you may want to move this handling logic to an intent code hook
  const intent = intentFromLexResponse(recognizeResponse);

  switch (intent) {
    case "Agent":
      await sendToFlex(AccountSid, ConversationSid, BotId, Author, WebhookSid);
      break;

    case "OrderFlowers":
      if (isOrderFullfilledFromLextResponse(recognizeResponse)) {
        await closeConversation(AccountSid, ConversationSid);
      }
      break;

    default:
      break;
  }

  return;
};
