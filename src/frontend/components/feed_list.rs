use leptos::*;

#[component]
pub fn FeedList() -> impl IntoView {
    view! {
        <div>
            <h2>"Feeds"</h2>
            <ul>
                <li>"Sample Feed 1"</li>
                <li>"Sample Feed 2"</li>
            </ul>
        </div>
    }
}
