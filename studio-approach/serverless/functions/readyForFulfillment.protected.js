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

exports.handler = async (context, event, callback) => {
  const { channelSid, serviceSid, intent, slots } = event;

  // Just log out the data in the slots. Realworld this would be processed depending on the biz logic required.
  console.log(channelSid, intent, slots);

  // Close the chat channel so that no more messages can be sent to the bot
  await closeChat(context, channelSid, serviceSid);

  return callback(null, { result: "ok" });
};
