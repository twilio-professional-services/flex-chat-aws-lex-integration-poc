const {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} = require("@aws-sdk/client-lex-runtime-v2");

exports.handler = async (context, event, callback) => {
  const { ChannelSid } = JSON.parse(event.trigger)?.message;
  const { customerMessage } = event;
  const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_BOT_ALIAS_ID,
    AWS_BOT_ID,
  } = context;

  const config = {
    region: "us-east-1",
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  };
  const input = {
    botAliasId: AWS_BOT_ALIAS_ID,
    botId: AWS_BOT_ID,
    localeId: "en_US",
    text: customerMessage,
    sessionId: ChannelSid,
  };
  const client = new LexRuntimeV2Client(config);

  const command = new RecognizeTextCommand(input);

  const response = await client.send(command);

  const responseToStudio = {
    intent: response.sessionState?.intent?.name,
    state: response.sessionState?.intent?.state,
    botReplyMessage: response.messages?.[0]?.content,
    slots: response.sessionState?.intent?.slots,
  };

  console.log(responseToStudio);

  return callback(null, responseToStudio);
};
