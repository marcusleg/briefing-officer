use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::error::Error;

#[derive(Serialize, Deserialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

pub struct AiClient {
    client: Client,
    base_url: String,
    api_key: String,
}

impl AiClient {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            api_key,
        }
    }

    pub async fn summarize(&self, text: &str) -> Result<String, Box<dyn Error>> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        
        let request = ChatCompletionRequest {
            model: "gpt-3.5-turbo".to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are a helpful assistant that summarizes text concisely.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: format!("Please summarize the following text:\n\n{}", text),
                },
            ],
        };

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await?;

        let response_data: ChatCompletionResponse = response.json().await?;
        
        if let Some(choice) = response_data.choices.first() {
            Ok(choice.message.content.clone())
        } else {
            Err("No completion choices found".into())
        }
    }
}
