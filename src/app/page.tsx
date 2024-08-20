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

  return (
    <main>
      <div>Last refresh: {new Date().toISOString()}</div>
      {feeds.map((feed) => (
        <section key={feed?.id}>
          <h2>{feed?.title}</h2>
          {feed?.items.map((item) => (
            <article key={item.id}>
              <h3>
                <a href={`/summary/${encodeURIComponent(item.link!!)}`}>
                  {item.title}
                </a>
              </h3>
              <p>{item.pubDate?.toISOString()}</p>
              <p>{item.description}</p>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
};

export default Home;
