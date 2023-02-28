const axios = require("axios");

const botNameFromPreEngagement = (pre_engagement_data) => {
  if (!pre_engagement_data || !pre_engagement_data.location) {
    return null;
  }

  return new URLSearchParams(pre_engagement_data.location).get("botName");
};

const postCustomerMessageToBot = async (
  customerMessage,
  sessionId,
  botName,
  botPostUrl
) => {
  try {
    await axios.post(botPostUrl, { customerMessage, sessionId, botName });
  } catch (error) {
    console.error(error);
  }
};

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();

  // webhook from prog chat for message added to channel
  const { InstanceSid, ChannelSid, Body } = event;
  const { BOT_MESSAGE_POST_URL } = context;

  const channel = await client.chat.v2
    .services(InstanceSid)
    .channels(ChannelSid)
    .fetch();

  const channelAttributes = JSON.parse(channel.attributes);
  const botName = botNameFromPreEngagement(
    channelAttributes.pre_engagement_data
  );

  console.log(channel.sid, Body, botName);
  // pass the botName and message body to the bot.
  // when the bot has a reply it will send it async via the outboundChatMessageHandler webhook
  await postCustomerMessageToBot(
    Body,
    ChannelSid,
    botName,
    BOT_MESSAGE_POST_URL
  );

  return callback(null, {});
};
