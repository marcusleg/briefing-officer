# Changelog

## [0.18.0](https://github.com/marcusleg/briefing-officer/compare/v0.17.0...v0.18.0) (2026-10-04)

### Features

- Articles that link to a PDF, which is common on Hacker News, are now read in
  full, so their lead and summary come from the document's text and author
  instead of the title alone. Other links that are not web pages are skipped
  instead of stalling the app while it scrapes them.
  ([#796](https://github.com/marcusleg/briefing-officer/pull/796),
  [#793](https://github.com/marcusleg/briefing-officer/pull/793), closes
  [#794](https://github.com/marcusleg/briefing-officer/issues/794),
  [#792](https://github.com/marcusleg/briefing-officer/issues/792))
- Read Later articles now show on the home feed, below the unread ones, instead
  of only on their own page. The unread count still counts only unread articles.
  ([#791](https://github.com/marcusleg/briefing-officer/pull/791))
- Set `LOG_LEVEL` (`trace` to `fatal`) to control how much the app logs. At
  `debug`, every background job logs how long it took and how much memory the
  app used. ([#788](https://github.com/marcusleg/briefing-officer/pull/788),
  closes [#780](https://github.com/marcusleg/briefing-officer/issues/780))

### Bug Fixes

- A background job that keeps crashing the app is now given up on after a few
  attempts instead of being retried on every restart.
  ([#793](https://github.com/marcusleg/briefing-officer/pull/793), closes
  [#792](https://github.com/marcusleg/briefing-officer/issues/792))
- Article leads now state the news itself instead of opening with "The
  article..." and ending on a stock sentence about timeliness.
  ([#795](https://github.com/marcusleg/briefing-officer/pull/795))

### Dependencies

- Updated Next.js to 16.3.6, React to 19.3.0 and Prisma to 7.10.0.
  ([#790](https://github.com/marcusleg/briefing-officer/pull/790))

## [0.17.0](https://github.com/marcusleg/briefing-officer/compare/v0.16.0...v0.17.0) (2026-09-18)

### Features

- The Helm chart takes new values: `env` for extra environment variables,
  `persistence.storageClassName`, `persistence.existingClaim` to use a volume
  claim managed outside the chart, `priorityClassName`, `baseUrl` and
  `authSecret`. ([#784](https://github.com/marcusleg/briefing-officer/pull/784))

### Bug Fixes

- Helm upgrades no longer sign everyone out. The chart generated a new
  `AUTH_SECRET` on every render and it overrode the one in your release secret.
  It now generates the secret once, keeps it across upgrades and lets an
  `AUTH_SECRET` from your release secret or the new `authSecret` value take
  precedence. ([#784](https://github.com/marcusleg/briefing-officer/pull/784),
  closes [#785](https://github.com/marcusleg/briefing-officer/issues/785))
- The chart now derives `BASE_URL` with its `https://` scheme, and
  `persistence.enabled: false` renders a working Deployment backed by an empty
  directory. ([#784](https://github.com/marcusleg/briefing-officer/pull/784))

## [0.16.0](https://github.com/marcusleg/briefing-officer/compare/v0.15.0...v0.16.0) (2026-09-15)

### ⚠ Breaking Changes

- Feeds are now refreshed by a worker inside the app, so the external cron job
  is gone: `/api/cron`, the `CRON_API_TOKEN` setting and the Helm chart's
  CronJob and its NetworkPolicy are removed. Delete any cron job or scheduler
  that calls `/api/cron`. Set `FEED_REFRESH_INTERVAL_MINUTES` (default 15) to
  change how often feeds refresh, or `BACKGROUND_WORKER_DISABLED=true` to turn
  the worker off.
  ([#778](https://github.com/marcusleg/briefing-officer/pull/778))

### Features

- Feeds now refresh on a schedule in the background, so you no longer need an
  external cron job, and pages no longer wait for a refresh to finish. Failed
  jobs are retried with increasing delays.
  ([#778](https://github.com/marcusleg/briefing-officer/pull/778))
- Open pages update when background work finishes: leads fill in and the sidebar
  counts change on their own. New articles are announced with a "Show N new
  articles" button instead of moving the list while you read.
  ([#778](https://github.com/marcusleg/briefing-officer/pull/778))
- Move your feeds to or from another reader with OPML. Import OPML and Export
  OPML are in the user menu. Folders become categories, and feeds you already
  have are skipped.
  ([#775](https://github.com/marcusleg/briefing-officer/pull/775),
  [#779](https://github.com/marcusleg/briefing-officer/pull/779), closes
  [#776](https://github.com/marcusleg/briefing-officer/issues/776))

## [0.15.0](https://github.com/marcusleg/briefing-officer/compare/v0.14.0...v0.15.0) (2026-09-12)

### ⚠ Breaking Changes

- Each feed's free-text interest profile is replaced by keyword lists and is not
  carried over. Enter your interests again as keywords. Every feed, including
  existing ones, also gets "advertisements" and "sponsored posts" as
  disinterests, so feeds that were not filtered before now run the filter on
  every article. Delete both keywords to turn filtering off for a feed.
  ([#750](https://github.com/marcusleg/briefing-officer/pull/750))

### Features

- Each feed has an "Interested in" and a "Not interested in" keyword list, which
  you edit in the feed form. When keywords from both lists apply to an article,
  the more specific one wins, so "kernel development, but not USB drivers"
  works. The Add Feed form is prefilled with default disinterests, lists are
  sorted alphabetically, and a feed's filters are summarised in plain English.
  ([#750](https://github.com/marcusleg/briefing-officer/pull/750))
- Rejecting an article with Not interested now offers three suggested keywords,
  from narrow to broad, and a field for your own, so the feed learns what to
  hide next time. Articles you reject by hand are filed with the filtered ones.
  ([#750](https://github.com/marcusleg/briefing-officer/pull/750))
- The Your Daily Activity and Filtered Articles charts now break each day down
  by feed. ([#753](https://github.com/marcusleg/briefing-officer/pull/753))

### Bug Fixes

- Dashboard charts give each feed the same colour in every chart, and two feeds
  with the same title are no longer merged into one series.
  ([#767](https://github.com/marcusleg/briefing-officer/pull/767), closes
  [#754](https://github.com/marcusleg/briefing-officer/issues/754),
  [#755](https://github.com/marcusleg/briefing-officer/issues/755))

## [0.14.0](https://github.com/marcusleg/briefing-officer/compare/v0.13.0...v0.14.0) (2026-08-14)

### Features

- Describe what you want from a feed in plain language and an AI model hides
  articles that do not match. Hidden articles are kept, never deleted, each with
  a one-line reason. Feeds without a profile are not filtered. This replaces
  Title Filter Expressions: existing expressions are carried over into the
  profile, but feeds that used regular expressions are now filtered by AI and
  use more tokens.
  ([#747](https://github.com/marcusleg/briefing-officer/pull/747))
- A Not interested button rejects an article by hand. Choose View, then Not
  interested, on a feed to review everything that was hidden and restore it.
  ([#747](https://github.com/marcusleg/briefing-officer/pull/747))
- A Filtered page in the sidebar lists everything that never reached your feed,
  and a daily chart on the dashboard shows how much was filtered by the model
  and how much you rejected.
  ([#749](https://github.com/marcusleg/briefing-officer/pull/749))

### Bug Fixes

- Read Later articles are no longer counted as unread in the dashboard chart and
  in the prompt about your other feeds, an article that was read and then saved
  for later no longer appears in both History and Read Later, and undoing
  Dismiss or Restore puts the article back where it was.
  ([#747](https://github.com/marcusleg/briefing-officer/pull/747))

## [0.13.0](https://github.com/marcusleg/briefing-officer/compare/v0.12.0...v0.13.0) (2026-08-08)

### Features

- Listen to an article briefing. The speaker icon on an article card, or the `a`
  key, opens an audio page that reads the title, author and feed straight away,
  then speaks a script written for listening while the transcript streams in and
  highlights the sentence being read. Choose a playback speed from 1.0x to 2.0x.
  The speech uses your browser's built-in voices.
  ([#724](https://github.com/marcusleg/briefing-officer/pull/724),
  [#725](https://github.com/marcusleg/briefing-officer/pull/725),
  [#735](https://github.com/marcusleg/briefing-officer/pull/735),
  [#736](https://github.com/marcusleg/briefing-officer/pull/736))
- Articles show the author the feed itself declares, instead of a byline guessed
  from the page.
  ([#726](https://github.com/marcusleg/briefing-officer/pull/726))

### Bug Fixes

- Leads, text summaries and audio briefings are now written in the article's own
  language instead of sometimes switching to English. The briefing is spoken by
  a matching voice where one is installed; otherwise the page says which voice
  is missing. ([#734](https://github.com/marcusleg/briefing-officer/pull/734))
- When the AI provider fails, the summary page now shows what arrived and
  reports the failure instead of waiting forever, and the failure can no longer
  crash the app.
  ([#737](https://github.com/marcusleg/briefing-officer/pull/737))
- Signed-out visitors are redirected to the sign-in page from search and
  category pages instead of seeing an error.
  ([#737](https://github.com/marcusleg/briefing-officer/pull/737))
- The unread articles chart on the dashboard no longer disappears in narrow
  layouts. ([#706](https://github.com/marcusleg/briefing-officer/pull/706))
- Fixed the known security vulnerabilities in dependencies that GitHub's
  Dependabot reported.
  ([#744](https://github.com/marcusleg/briefing-officer/pull/744))

### Dependencies

- Updated Next.js to 16.3.0, React to 19.2.8, Prisma to 7.9.1 and the AI SDK to
  7.0. ([#692](https://github.com/marcusleg/briefing-officer/pull/692),
  [#744](https://github.com/marcusleg/briefing-officer/pull/744))

## [0.12.0](https://github.com/marcusleg/briefing-officer/compare/v0.11.0...v0.12.0) (2026-07-11)

### ⚠ Breaking Changes

- The upgrade to Prisma 7 changes how a relative `DATABASE_URL` is resolved:
  `file:` paths now start from the directory the app runs in, no longer from the
  `prisma` folder. If yours is relative, change `file:../data/database.sqlite`
  to `file:./data/database.sqlite`.
  ([#690](https://github.com/marcusleg/briefing-officer/pull/690))

### Features

- Opening an article no longer marks it as read. Use the Dismiss button, which
  now shows a checkmark instead of a trash icon.
  ([#690](https://github.com/marcusleg/briefing-officer/pull/690))

### Bug Fixes

- Failed feed refreshes and article processing now log the error message and
  stack trace instead of an empty object.
  ([#679](https://github.com/marcusleg/briefing-officer/pull/679))

### Performance Improvements

- Page loads no longer stall while a feed refresh is writing to the database.
  ([#681](https://github.com/marcusleg/briefing-officer/pull/681))

### Dependencies

- Updated Prisma to 7.8.0.

## [0.11.0](https://github.com/marcusleg/briefing-officer/compare/v0.10.0...v0.11.0) (2026-06-21)

### Features

- Summaries and leads are generated from refined prompts: the summary picks "Key
  Facts", "Key Takeaways" or "Key Points" to suit the article, and the model is
  given the article title as well as its text.
  ([#670](https://github.com/marcusleg/briefing-officer/pull/670))

### Bug Fixes

- Article cards no longer grow wider than a phone screen and scroll sideways
  when a lead contains long unbreakable text.
  ([#676](https://github.com/marcusleg/briefing-officer/pull/676))
- The Read button is muted so it no longer competes with the other buttons.
  ([#673](https://github.com/marcusleg/briefing-officer/pull/673))

## [0.10.0](https://github.com/marcusleg/briefing-officer/compare/v0.9.1...v0.10.0) (2026-06-17)

### Features

- Dismissing an article from its AI summary page takes you back to the page you
  came from. ([#669](https://github.com/marcusleg/briefing-officer/pull/669))

### Bug Fixes

- The token usage chart no longer shows cost estimates, which were mostly wrong,
  or reasoning tokens.
  ([#667](https://github.com/marcusleg/briefing-officer/pull/667))

## [0.9.1](https://github.com/marcusleg/briefing-officer/compare/v0.9.0...v0.9.1) (2026-06-17)

### Bug Fixes

- On the AI summary page, the text spacing matches the article cards and the
  back button is aligned to the left.
  ([#665](https://github.com/marcusleg/briefing-officer/pull/665))

## [0.9.0](https://github.com/marcusleg/briefing-officer/compare/v0.8.0...v0.9.0) (2026-06-17)

### Features

- Redesigned article cards: the feed name and publication date sit above the
  title, most fonts are larger, buttons are renamed (Read, Summarize) and
  reordered, and reading time moves to the footer. Read Later, Star and Comments
  collapse to icons with tooltips, and Mark as read becomes Dismiss and Restore.
  ([#655](https://github.com/marcusleg/briefing-officer/pull/655),
  [#660](https://github.com/marcusleg/briefing-officer/pull/660),
  [#664](https://github.com/marcusleg/briefing-officer/pull/664))
- Click the feed name on an article card to open that feed.
  ([#663](https://github.com/marcusleg/briefing-officer/pull/663))
- The AI summary page follows the article card layout, with the action buttons
  below the summary and the reading time shown.
  ([#661](https://github.com/marcusleg/briefing-officer/pull/661))

## [0.8.0](https://github.com/marcusleg/briefing-officer/compare/v0.7.0...v0.8.0) (2026-06-11)

### Features

- Summaries are now a single list of 5 to 12 key facts or takeaways, without the
  Executive Summary and "Why the Full Article Is Worth Reading" sections.
  ([#652](https://github.com/marcusleg/briefing-officer/pull/652))

### Bug Fixes

- Fixed React console errors from the theme switcher and from the Add Category
  and Add Feed buttons in the sidebar.
  ([#649](https://github.com/marcusleg/briefing-officer/pull/649))

## [0.7.0](https://github.com/marcusleg/briefing-officer/compare/v0.6.1...v0.7.0) (2026-06-04)

### Features

- Pause a feed without deleting it with the new "Refresh Automatically" switch
  in the feed form. Paused feeds are skipped by automatic and bulk refreshes,
  appear greyed out with a pause icon in the sidebar and are announced as paused
  to screen readers. Refreshing the feed by hand still works.
  ([#636](https://github.com/marcusleg/briefing-officer/pull/636))
- Article cards show a Comments link when the RSS feed provides a `<comments>`
  URL. ([#642](https://github.com/marcusleg/briefing-officer/pull/642))
- Form inputs and buttons are disabled while a form is submitting.
  ([#634](https://github.com/marcusleg/briefing-officer/pull/634))

### Dependencies

- Updated Next.js to 16.2.7, React to 19.2.7 and Prisma to 6.19.3.

## [0.6.1](https://github.com/marcusleg/briefing-officer/compare/v0.6.0...v0.6.1) (2026-04-01)

### Bug Fixes

- Mark as read on a feed no longer marks the articles you saved for Read Later.
  ([#618](https://github.com/marcusleg/briefing-officer/pull/618))
- The sidebar search field is no longer focused when you open the sidebar on a
  phone. ([#612](https://github.com/marcusleg/briefing-officer/pull/612))

### Dependencies

- Updated Next.js to 16.1.7 and React to 19.2.4.
  ([#610](https://github.com/marcusleg/briefing-officer/pull/610))

## [0.6.0](https://github.com/marcusleg/briefing-officer/compare/v0.5.0...v0.6.0) (2026-02-18)

### ⚠ Breaking Changes

- The Anthropic and Azure OpenAI model names are no longer built in. Set
  `ANTHROPIC_MODEL` or `AZURE_OPENAI_MODEL`, depending on your provider, before
  upgrading. ([#496](https://github.com/marcusleg/briefing-officer/pull/496))

### Features

- Use OpenAI or any OpenAI-compatible API as the AI provider. Set
  `OPENAI_API_KEY` and `OPENAI_MODEL`, and `OPENAI_BASE_URL` for a provider
  other than OpenAI.
  ([#585](https://github.com/marcusleg/briefing-officer/pull/585))
- Sign in with a single sign-on (OAuth) provider. Enable it with
  `NEXT_PUBLIC_AUTH_GENERIC_OAUTH_ENABLE` and configure it with the
  `AUTH_GENERIC_OAUTH_*` settings.
  ([e09aa26](https://github.com/marcusleg/briefing-officer/commit/e09aa26ddd8b359548cc8d9d57417df8fa6a91a1))
- The Helm chart can create a NetworkPolicy. Turn it on with
  `networkPolicy.enabled`.
  ([#589](https://github.com/marcusleg/briefing-officer/pull/589))

### Bug Fixes

- The Star and Read Later buttons use colours that suit light and dark mode.
  ([#602](https://github.com/marcusleg/briefing-officer/pull/602))
- `AUTH_SELF_REGISTRATION_ENABLED` now controls self-registration as documented.
  ([90eb5e6](https://github.com/marcusleg/briefing-officer/commit/90eb5e6a036783e60bff570c74c238f84e6d17dd))
- The Helm chart's deployment now sets `BASE_URL` and `AUTH_SECRET`.
  ([00bd088](https://github.com/marcusleg/briefing-officer/commit/00bd0888f0b1d1bdfd577b2fccea75a5520ab108))
- The user management page lists users sorted by name.
  ([08053ff](https://github.com/marcusleg/briefing-officer/commit/08053ff6ab7b9969598000c244ad12f7c11fc2c4))

### Dependencies

- Updated Next.js to 16.1.6, the AI SDK to 6.0 and Node.js to 24.13.0.
  ([#586](https://github.com/marcusleg/briefing-officer/pull/586))

## [0.5.0](https://github.com/marcusleg/briefing-officer/compare/v0.4.0...v0.5.0) (2025-12-14)

### Features

- Empty pages, such as an empty feed or no search results, have a new design.
  ([fb367d0](https://github.com/marcusleg/briefing-officer/commit/fb367d0901433e3d5fab50dfa23e97770e5b8d41))

### Dependencies

- Updated Next.js to 16.0.10 and React to 19.2.3.

## [0.4.0](https://github.com/marcusleg/briefing-officer/compare/v0.3.0...v0.4.0) (2025-12-07)

### Features

- Deploy Briefing Officer to Kubernetes with the new Helm chart.
  ([#230](https://github.com/marcusleg/briefing-officer/pull/230))
- The app answers liveness and readiness probes at `/api/health/liveness` and
  `/api/health/readiness`, and the Helm chart uses them.
  ([82309ef](https://github.com/marcusleg/briefing-officer/commit/82309efe814ed6432ffe6e909fbb16aa5f3e525b))

### Bug Fixes

- Long words in article titles no longer overflow the card.
  ([3980866](https://github.com/marcusleg/briefing-officer/commit/39808664c7740811da60359d1cc30656c9d251e8),
  [6b93ba2](https://github.com/marcusleg/briefing-officer/commit/6b93ba2d879d157325d70a812d58019a47a57ce0),
  [3c878c3](https://github.com/marcusleg/briefing-officer/commit/3c878c3cf45d6bc7c689c83834b9d6f6a16a2480))

### Dependencies

- Updated Next.js to 15.5.7 and Prisma to 6.18.0.

## [0.3.0](https://github.com/marcusleg/briefing-officer/compare/v0.2.0...v0.3.0) (2025-09-10)

### Features

- The article action buttons are laid out as a grid on small screens.
  ([07be19b](https://github.com/marcusleg/briefing-officer/commit/07be19b944a79ee8b13199e62ced4d77e77925da))

### Bug Fixes

- Feeds with long titles look better in the sidebar.
  ([847057a](https://github.com/marcusleg/briefing-officer/commit/847057aa238cbac5b2476ef81628a71bd5ffa0dd))

### Dependencies

- Updated Next.js to 15.5.2 and Prisma to 6.16.0.

## [0.2.0](https://github.com/marcusleg/briefing-officer/compare/v0.1.1...v0.2.0) (2025-08-22)

### Features

- Press `s` on a selected article to open its AI summary.
  ([dd3cc54](https://github.com/marcusleg/briefing-officer/commit/dd3cc542e58b1c519cf2ec11650d6697f058e265))
- Redesigned the reading time badge and action buttons on article cards.
  ([57e0642](https://github.com/marcusleg/briefing-officer/commit/57e064288a1ad413242bbe247de68ddc774e7700))

### Bug Fixes

- Article cards fit better on mobile screens.
  ([e001776](https://github.com/marcusleg/briefing-officer/commit/e00177624ed898dda2d534af0becf17296437273))
- The dashboard no longer shifts sideways when its content loads.
  ([cf7d0d1](https://github.com/marcusleg/briefing-officer/commit/cf7d0d159f5507416db4fb414cb2880f1cab00f2))

## [0.1.1](https://github.com/marcusleg/briefing-officer/compare/briefing-officer-v0.1.0...briefing-officer-v0.1.1) (2025-08-22)

### Features

- Sign in, sign up and sign out with accounts. The first user becomes the
  administrator, new accounts must be approved by an administrator, and
  self-registration is turned off after the first account exists. Administrators
  manage users, including banning and unbanning them. Every feed and article
  belongs to one user.
  ([d3ff7aa](https://github.com/marcusleg/briefing-officer/commit/d3ff7aa337eea7250414559040442817c55366ae),
  [569afff](https://github.com/marcusleg/briefing-officer/commit/569afff7fe1d72587a190a31334e8ab0ef9a79d0),
  [9095c56](https://github.com/marcusleg/briefing-officer/commit/9095c56ca0216253e423636bbdfe133c7bc10c69),
  [8bf80d0](https://github.com/marcusleg/briefing-officer/commit/8bf80d04395f29d334cf0ffc8501d54fe6b28a4d),
  [85faf01](https://github.com/marcusleg/briefing-officer/commit/85faf0193bacf1353f79887e2e3cd698122e1e95),
  [a7343b2](https://github.com/marcusleg/briefing-officer/commit/a7343b28427c755cf9c46bcb98cc06857f821f90),
  [6eb0496](https://github.com/marcusleg/briefing-officer/commit/6eb0496cf0b508d462597a6fd05c48a6940d6f07))
- Every article gets an AI-written lead, generated when it is scraped or on
  demand, and streamed in as it scrolls into view. AI summaries stream in as
  well and open on their own page with the article metadata and a link to the
  source. Choose OpenAI or Anthropic as the provider.
  ([#227](https://github.com/marcusleg/briefing-officer/pull/227),
  [#228](https://github.com/marcusleg/briefing-officer/pull/228),
  [b28455d](https://github.com/marcusleg/briefing-officer/commit/b28455d3a8296819369de65bc6a871f29d4f3644),
  [7047f1b](https://github.com/marcusleg/briefing-officer/commit/7047f1bc48a2f1596f08a91ccfd8503948a3e445),
  [761a376](https://github.com/marcusleg/briefing-officer/commit/761a3764285d417463d26450441a02714c3bf642))
- Generated AI texts are cached in memory, so repeated requests do not call the
  model again. ([#229](https://github.com/marcusleg/briefing-officer/pull/229))
- Token usage is tracked and shown in a chart.
  ([fd7328d](https://github.com/marcusleg/briefing-officer/commit/fd7328d4fd65da55d6b267f87ab3cf02e0a6818f))
- Organise feeds in categories. A category page lets you edit or delete the
  category, refresh all its feeds and mark all its articles as read.
  ([#238](https://github.com/marcusleg/briefing-officer/pull/238))
- A new sidebar navigation with breadcrumbs, redesigned article cards and
  article counts on the main pages.
  ([#231](https://github.com/marcusleg/briefing-officer/pull/231))
- A redesigned dashboard on the front page.
  ([#232](https://github.com/marcusleg/briefing-officer/pull/232))
- Search articles.
  ([25426dd](https://github.com/marcusleg/briefing-officer/commit/25426ddabb244e644bafcb403f60b4bed3d38473))
- Dark mode follows your system setting and can be toggled.
  ([e974e55](https://github.com/marcusleg/briefing-officer/commit/e974e55891e3d215c9c2955a0f38c79db94267eb))
- Articles older than one year are deleted automatically.
  ([6afcd8c](https://github.com/marcusleg/briefing-officer/commit/6afcd8c7fa927b3f063fd9d9f07f5d86f0282b75))
- Toast notifications confirm starring and saving articles for later.
  ([b53f0d0](https://github.com/marcusleg/briefing-officer/commit/b53f0d0b10c5023ede953068dd1d0ac0ad9eaef0),
  [f0c78d4](https://github.com/marcusleg/briefing-officer/commit/f0c78d4f4dfb5063c99eee55b015d50c80e8ecfe))
- The feed page shows when the feed was last updated.
  ([43a77be](https://github.com/marcusleg/briefing-officer/commit/43a77be526f18c23d5e916b2b4375de4b0fe14db))
- The `/api/cron` endpoint, which refreshes the feeds, is protected by a token.
  ([d128693](https://github.com/marcusleg/briefing-officer/commit/d128693d285afaf2e6ed1984fa054e0aa82533f1))

### Bug Fixes

- Leads and summaries are no longer made up from the title alone when an article
  could not be scraped.
  ([18a8a71](https://github.com/marcusleg/briefing-officer/commit/18a8a7187cc4df891720d563dc9b58e62c75f693),
  [9d867be](https://github.com/marcusleg/briefing-officer/commit/9d867be82f66a35234d9ca08f3d7983dc9248ffd))
- Articles saved for later no longer count towards the number of unread
  articles.
  ([f81cfc4](https://github.com/marcusleg/briefing-officer/commit/f81cfc43e7c0c8180db5fbead7058b3242603958))
