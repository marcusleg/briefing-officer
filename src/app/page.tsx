import { parseFeed } from "htmlparser2";

const feeds = [
  "https://feeds.feedburner.com/Phoronix",
  "https://www.heise.de/developer/rss/news-atom.xml",
];

const fetchFeeds = async () => {
  const promises = feeds.map((feed) => fetch(feed).then((res) => res.text()));
  const results = await Promise.all(promises);
  return results.map((result) => parseFeed(result));
};

const Home = async () => {
  const feeds = await fetchFeeds();

  return <main>This is the frontpage.</main>;
};

export default Home;
