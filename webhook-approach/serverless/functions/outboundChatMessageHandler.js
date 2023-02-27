const closeChat = async (context, channelSid, serviceSid) => {
  let client = context.getTwilioClient();

  if (!channelSid) {
    callback("missing channelSid");
  }
  try {
    console.log(`Closing channel ${channelSid}`);

    // retrieve current chat channel attributes
    const channel = await client.chat.v2
      .services(serviceSid)
      .channels(channelSid)
      .fetch();

    const channelAttributes = JSON.parse(channel.attributes);
    const updatedChannelAttributes = {
      ...channelAttributes,
      status: "INACTIVE",
    };

    await client.chat.v2
      .services(serviceSid)
      .channels(channelSid)
      .update({
        attributes: JSON.stringify(updatedChannelAttributes),
        xTwilioWebhookEnabled: true,
      });
  } catch (err) {
    console.log(err);
  }
};

const sendToFlex = async (context, channelSid) => {
  const client = context.getTwilioClient();
  const {
    INBOUND_CHAT_MESSAGE_HANDLER_PATH,
    TWILIO_FLEX_CHAT_SERVICE_SID,
    FLEX_WORKSPACE_SID,
  } = context;

  const channel = await client.chat.v2
    .services(context.TWILIO_FLEX_CHAT_SERVICE_SID)
    .channels(channelSid)
    .fetch();

  // for convenience, we'll just add the channels attributes to the task attributes along with the sid
  // the task attributes will then have the customer name and pre-engagement data
  // for real world use cases adjust this so that the task attributes will have data for the workflow routing
  const channelAttributes = JSON.parse(channel.attributes);
  const taskAttributes = { ...channelAttributes, channelSid: channelSid };

  taskAttributes.channelSid = channelSid; // ensure we route the prog chat channel to the agent

  if (channelAttributes.status !== "ACTIVE") return;

  // create a task
  const task = await client.taskrouter.v1
    .workspaces(FLEX_WORKSPACE_SID)
    .tasks.create({
      attributes: JSON.stringify(taskAttributes),
      workflowSid: context.FLEX_WORKFLOW_SID,
    });

  const webhooks = await client.chat.v2
    .services(TWILIO_FLEX_CHAT_SERVICE_SID)
    .channels(channelSid)
    .webhooks.list();

  // remove the flex flows webhook so that subsequent customer message or agent replies don't go to the bot
  for await (const webhook of webhooks) {
    if (webhook.configuration.url.includes(INBOUND_CHAT_MESSAGE_HANDLER_PATH)) {
      console.log("removing webhook", webhook.sid, webhook.configuration.url);
      await client.chat.v2
        .services(TWILIO_FLEX_CHAT_SERVICE_SID)
        .channels(channelSid)
        .webhooks(webhook.sid)
        .remove();
    }
  }

  console.log("created task", task);
};

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();
  const { botReplyMessage, sessionId, nextStep } = event;
  const { TWILIO_FLEX_CHAT_SERVICE_SID } = context;

  console.log(botReplyMessage, nextStep, sessionId);

  // add a message if bot had a reply (CLOSE_CHAT may not need a reply message to be sent)
  if (botReplyMessage) {
    await client.chat.v2
      .services(TWILIO_FLEX_CHAT_SERVICE_SID)
      .channels(sessionId)
      .messages.create({ body: botReplyMessage, from: "Lex" });
  }

  switch (nextStep) {
    case "AGENT":
      await sendToFlex(context, sessionId);
      break;

    case "CLOSE_CHAT":
      await closeChat(context, sessionId, TWILIO_FLEX_CHAT_SERVICE_SID);
      break;

    // we will just send the bot reply and wait for the next message from the customer
    default:
      break;
  }

  return callback(null, {});
};
