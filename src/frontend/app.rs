use leptos::*;
use crate::frontend::components::feed_list::FeedList;
use crate::frontend::components::article_view::ArticleView;

#[component]
pub fn App() -> impl IntoView {
    view! {
        <main>
            <h1>"Briefing Officer"</h1>
            <div class="container">
                <section class="feeds">
                    <FeedList />
                </section>
                <section class="articles">
                    <ArticleView />
                </section>
            </div>
        </main>
    }
}
