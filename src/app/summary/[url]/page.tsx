import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import DOMPurify from "isomorphic-dompurify";

const getUrl = async (url: string) => {
  const response = await axios.get(url);
  return response.data;
};

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: "eu-central-1",
});
const generateSummary = async (title: string, content: string) => {
  const command = new ConverseCommand({
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: `Sum up this article:\n\n${title}\n\n${content}`,
          },
        ],
      },
    ],
  });
  const response = await bedrockRuntimeClient.send(command);

  if (response.output?.message?.content?.length == 0) {
    return null;
  }

  return response.output?.message.content[0].text;
};

// @ts-ignore
const foo = (x) => typeof x === "string" && x;

const Summary = async ({ params }: { params: { url: string } }) => {
  const url = decodeURIComponent(params.url);
  const body = await getUrl(url);
  const cleanBody = DOMPurify.sanitize(body);
  const document = new JSDOM(cleanBody);
  const article = new Readability(document.window.document).parse();

  if (!article) {
    return <div>Failed to parse article</div>;
  }

  const summary = await generateSummary(article.title, article.textContent);

  return (
    <div>
      <h2>
        <a href={url}>{article?.title}</a>
      </h2>
      <h3>Summary</h3>
      <p style={{ whiteSpace: "pre" }}>{summary}</p>
      <h3>Full article</h3>
      <p dangerouslySetInnerHTML={{ __html: article?.content }}></p>
    </div>
  );
};

export default Summary;
