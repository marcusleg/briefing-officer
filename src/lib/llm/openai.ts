import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
  baseURL: process.env["OPENAI_API_URL"],
});

export const promptOpenAI = async (
  text: string,
  max_completion_tokens: number | null = null,
) => {
  const response = await client.chat.completions
    .create({
      messages: [
        {
          role: "system",
          content: "You are a briefing officer.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      model: "gpt-4.1-nano",
      stream: false,
      max_completion_tokens,
    })
    .withResponse();

  return response.data.choices[0].message.content;
};
