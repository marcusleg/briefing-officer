import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { ConfiguredRetryStrategy } from "@smithy/util-retry";

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: "eu-central-1",
  retryStrategy: new ConfiguredRetryStrategy(10, 2000),
});
export const promptClaude = async (text: string) => {
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: text,
          },
        ],
      },
    ],
  });
  const response = await bedrockRuntimeClient.send(command);

  if (
    !response.output?.message?.content ||
    response.output?.message?.content?.length == 0
  ) {
    return null;
  }

  return response.output?.message.content[0].text;
};
