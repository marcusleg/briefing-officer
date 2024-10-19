import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
  baseURL: process.env["OPENAI_API_URL"],
});

export const promptOpenAI = async (text: string) => {
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
      model: "gpt-4o-mini",
      stream: false,
    })
    .withResponse();

  return response.data.choices[0].message.content;
};
