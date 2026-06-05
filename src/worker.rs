use tokio::time::{interval, Duration};
use std::error::Error;
use crate::scraper::Scraper;
use crate::ai::AiClient;

pub struct Worker {
    scraper: Scraper,
    ai_client: AiClient,
    interval_duration: Duration,
}

impl Worker {
    pub fn new(base_url: String, api_key: String, interval_secs: u64) -> Self {
        Self {
            scraper: Scraper::new(),
            ai_client: AiClient::new(base_url, api_key),
            interval_duration: Duration::from_secs(interval_secs),
        }
    }

    pub async fn run(&self) -> Result<(), Box<dyn Error>> {
        let mut ticker = interval(self.interval_duration);

        loop {
            ticker.tick().await;
            println!("Worker: Starting scraping and summarization cycle...");

            // In a real implementation, this would fetch URLs from the database
            let test_url = "https://example.com"; 

            match self.scraper.scrape_url(test_url).await {
                Ok(html) => {
                    match self.scraper.parse_html(&html) {
                        Ok(contents) => {
                            let combined_text = contents.join(" ");
                            if !combined_text.is_empty() {
                                match self.ai_client.summarize(&combined_text).await {
                                    Ok(summary) => {
                                        println!("Worker: Summary generated successfully!");
                                        println!("Summary: {}", summary);
                                        // Here you would save the summary to the database
                                    }
                                    Err(e) => eprintln!("Worker: AI summarization failed: {}", e),
                                }
                            } else {
                                eprintln!("Worker: No content found to summarize.");
                            }
                        }
                        Err(e) => eprintln!("Worker: Parsing failed: {}", e),
                    }
                }
                Err(e) => eprintln!("Worker: Scraping failed: {}", e),
            }
        }
    }
}
