use scraper::{Html, Selector};
use reqwest::Client;
use std::error::Error;

pub struct Scraper {
    client: Client,
}

impl Scraper {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn scrape_url(&self, url: &str) -> Result<String, Box<dyn Error>> {
        let response = self.client.get(url).send().await?.text().await?;
        Ok(response)
    }

    pub fn parse_html(&self, html: &str) -> Result<Vec<String>, Box<dyn Error>> {
        let fragment = Html::parse_document(html);
        let selector = Selector::parse("p, h1, h2, h3").unwrap();
        let mut contents = Vec::new();

        for element in fragment.select(&selector) {
            contents.push(element.text().collect::<Vec<_>>().join(" "));
        }

        Ok(contents)
    }
}
