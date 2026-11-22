# Briefing Officer

A self-hosted news reader that tells readers the substance of each article from
their RSS and Atom feeds, so they can triage without opening anything.

## Language

### People

**Reader**:
A person with an account who follows feeds and triages their articles.
_Avoid_: User (except for the account itself), subscriber

**Administrator**:
A reader who can also approve, disable and delete other readers' accounts.
_Avoid_: Admin, superuser

**Operator**:
Whoever deploys and configures an instance, including its AI provider.
_Avoid_: Sysadmin, host

### Feeds and articles

**Feed**:
An RSS or Atom channel a reader has subscribed to.
_Avoid_: Subscription

**Category**:
A reader-named group of feeds.
_Avoid_: Folder

**Article**:
One item published by a feed.
_Avoid_: Entry, item, post, story

**Source**:
An article as written at its URL on the publisher's site.
_Avoid_: Original, link

**Ingest**:
The moment a fetched article enters a reader's feed and gets its lead and
filter decision.
_Avoid_: Arrival, import

**Article Text**:
The full text of an article, scraped from its source. Leads and text
summaries are written from it alone.
_Avoid_: Full text, content, body, description

**Scrape**:
To fetch an article's text from its source.
_Avoid_: Crawl, download

### What the AI writes

**Lead**:
A paragraph of at most 80 words that every article gets at ingest. It tells the
reader what the article reports, densely enough that it is often all they need.
_Avoid_: Teaser, excerpt

**Text Summary**:
A bullet list of an article's key facts: the first answer of a chat opened on
that article.
_Avoid_: Summary (on its own), key facts

**Chat**:
A conversation in which the AI answers the reader's questions from their
articles, linking to their sources, and can change articles' status when the
reader asks. A chat opened on an article is grounded in that article and starts
with its text summary.
_Avoid_: Assistant, Briefing Officer, article chat

### Triage

**Inbox**:
The articles still waiting for the reader: unread ones and those saved to read
later.

**Unread**:
The status of an article the reader has not yet triaged.
_Avoid_: New

**Dismissed**:
The status of an article the reader is done with, whether they read it or the
lead was enough.
_Avoid_: Read, done, cleared, seen

**Dismiss**:
To take an article out of the inbox because the reader is done with it.
_Avoid_: Mark as read, hide

**Restore**:
To put a dismissed or filtered article back in the inbox as unread.

**Read Later**:
The status of an article the reader set aside to come back to. It stays in the
inbox and is kept at least until the reader dismisses it.
_Avoid_: Bookmarked, parked

**Archived**:
A mark that keeps an article forever, independent of its status. Archiving an
article does not take it out of the inbox.
_Avoid_: Starred, favorite, pinned

### Filtering

**Feed Filter**:
A feed's two keyword lists, "interested in" and "not interested in", which decide
which of its articles reach the inbox.
_Avoid_: Interests, rules

**Filtered**:
The status of an article kept out of the inbox by a filter decision: the AI's at
ingest, or the reader's through Not Interested.
_Avoid_: Hidden, rejected, spam

**Not Interested**:
The reader's action of filtering an article themselves and, optionally, adding
a keyword to the feed filter so that similar articles stay out.
_Avoid_: Thumbs down, dislike
