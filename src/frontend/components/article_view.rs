use leptos::*;

#[component]
pub fn ArticleView() -> impl IntoView {
    view! {
        <div>
            <h2 id="article-title">"Article Title"</h2>
            <p id="article-content">"This is a sample article content."</p>
        </div>
    }

}
