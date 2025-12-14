# Changelog

## [0.5.0](https://github.com/marcusleg/briefing-officer/compare/v0.4.0...v0.5.0) (2025-12-14)


### Features

* new empty page designs using shadcn's `Empty` component ([fb367d0](https://github.com/marcusleg/briefing-officer/commit/fb367d0901433e3d5fab50dfa23e97770e5b8d41))


### Chores

* update NextJS to version 16.0.10

## [0.4.0](https://github.com/marcusleg/briefing-officer/compare/v0.3.0...v0.4.0) (2025-12-07)


### Features

* add liveness and readiness probes ([82309ef](https://github.com/marcusleg/briefing-officer/commit/82309efe814ed6432ffe6e909fbb16aa5f3e525b))
* Helm chart for application deployment ([b508970](https://github.com/marcusleg/briefing-officer/commit/b5089701f9048135962ce5fea393d2ec5a431b04))


### Bug Fixes

* improve word breaking in article titles ([3980866](https://github.com/marcusleg/briefing-officer/commit/39808664c7740811da60359d1cc30656c9d251e8))
* improve word breaking in article titles ([6b93ba2](https://github.com/marcusleg/briefing-officer/commit/6b93ba2d879d157325d70a812d58019a47a57ce0))
* prevent text overflow in article titles with `break-all` ([3c878c3](https://github.com/marcusleg/briefing-officer/commit/3c878c3cf45d6bc7c689c83834b9d6f6a16a2480))

## [0.3.0](https://github.com/marcusleg/briefing-officer/compare/v0.2.0...v0.3.0) (2025-09-10)


### Features

* display `ArticleCardActions` as a grid on small screens ([07be19b](https://github.com/marcusleg/briefing-officer/commit/07be19b944a79ee8b13199e62ced4d77e77925da))


### Bug Fixes

* improve sidebar item design for feeds with long titles ([847057a](https://github.com/marcusleg/briefing-officer/commit/847057aa238cbac5b2476ef81628a71bd5ffa0dd))

## [0.2.0](https://github.com/marcusleg/briefing-officer/compare/v0.1.1...v0.2.0) (2025-08-22)


### Features

* add keyboard shortcut for AI summary navigation in `ArticleCard` ([dd3cc54](https://github.com/marcusleg/briefing-officer/commit/dd3cc542e58b1c519cf2ec11650d6697f058e265))
* redesign `ArticleCard` reading time badges and action buttons ([57e0642](https://github.com/marcusleg/briefing-officer/commit/57e064288a1ad413242bbe247de68ddc774e7700))


### Bug Fixes

* improve `ArticleCard` layout for mobile devices ([e001776](https://github.com/marcusleg/briefing-officer/commit/e00177624ed898dda2d534af0becf17296437273))
* set width in `Dashboard` to avoid horizontal content jump ([cf7d0d1](https://github.com/marcusleg/briefing-officer/commit/cf7d0d159f5507416db4fb414cb2880f1cab00f2))

## [0.1.1](https://github.com/marcusleg/briefing-officer/compare/briefing-officer-v0.1.0...briefing-officer-v0.1.1) (2025-08-22)


### Features

* add `Breadcrumb` component and integrate it into navigation components ([63806ff](https://github.com/marcusleg/briefing-officer/commit/63806ff990d02a19182a717346f401555bb9d88b))
* add `userId` to `Article` and `Feed` models ([6eb0496](https://github.com/marcusleg/briefing-officer/commit/6eb0496cf0b508d462597a6fd05c48a6940d6f07))
* add `UserNavigation` component with sign-out functionality ([f8c167f](https://github.com/marcusleg/briefing-officer/commit/f8c167f6c4277e7fa34761bdd8ec6a6106e1f24a))
* add article count badges and separators to key pages ([a62f0ef](https://github.com/marcusleg/briefing-officer/commit/a62f0efe2ed1b006bfa42f7d18c75b3e2fc00f2b))
* add article retention filter and configure retention period in API route ([e4cbb1d](https://github.com/marcusleg/briefing-officer/commit/e4cbb1d97fc7fa9c2742830c3f3efa1735e2523a))
* add authentication to `createFeed` and associate feeds with users ([c593280](https://github.com/marcusleg/briefing-officer/commit/c5932809a0709b24c5e25537dfc174ae8c039816))
* add better-auth middleware ([1c92e9b](https://github.com/marcusleg/briefing-officer/commit/1c92e9bb8b0e9c9bcd9a42d1d18c6fb27d95c45d))
* add caching middleware for AI model to optimize repeated prompt handling ([801eb58](https://github.com/marcusleg/briefing-officer/commit/801eb589e7afceb0e908d0933e272d90c566e006))
* add dynamic model-based chart configuration to TokenUsageChart ([0eddc34](https://github.com/marcusleg/briefing-officer/commit/0eddc34b3fbe9313df1ffbc1b9347c2520060e6e))
* add edit and delete button to category page ([7922dd6](https://github.com/marcusleg/briefing-officer/commit/7922dd6f2844e6752c0e5d3494c637dbc082674e))
* add error handling and success notification to SignUpForm submission process ([c2e2a04](https://github.com/marcusleg/briefing-officer/commit/c2e2a04f5832b450371b095ef9628edb8250f8fe))
* add loading spinner to `ToggleReadButton` and refactor conditional rendering ([7e980fa](https://github.com/marcusleg/briefing-officer/commit/7e980fa4d55a7a103e2b8ce04a5f18ffa218ec85))
* add loading spinner to buttons in feed dialog and form components ([dc010df](https://github.com/marcusleg/briefing-officer/commit/dc010df8e6c20cd0d3b2fcc9c0c4f7f9bd4a3851))
* add mark-as-read button and functionality to category page ([da05f83](https://github.com/marcusleg/briefing-officer/commit/da05f83bbef332ece671c52e1513468dcc5ef883))
* add reasoning tokens to token usage tracking and charts ([872ffc6](https://github.com/marcusleg/briefing-officer/commit/872ffc65d2977d0698b15128b92f74e494db754f))
* add refresh category feeds button to category page ([e196de2](https://github.com/marcusleg/briefing-officer/commit/e196de296702340248d5943c14eb122d46a14a77))
* add session-based filtering to read later, read history, and starred articles ([a016424](https://github.com/marcusleg/briefing-officer/commit/a016424f090c552c55b9207b8342a445740cbe6d))
* add session-based filtering to unread articles query ([826acec](https://github.com/marcusleg/briefing-officer/commit/826acec36062a10c04fedb4ef40b66d9140ff4ee))
* add session-based user filtering to `LeftNavigation` feeds ([4273613](https://github.com/marcusleg/briefing-officer/commit/42736138059730d45ab01c186a171e53f02f6f09))
* add source link to AI summary page ([a30dfc8](https://github.com/marcusleg/briefing-officer/commit/a30dfc87484ac38330c6754028bdee72017db88f))
* add support for Anthropic ([761a376](https://github.com/marcusleg/briefing-officer/commit/761a3764285d417463d26450441a02714c3bf642))
* add title header to sidebar ([ae9ae2f](https://github.com/marcusleg/briefing-officer/commit/ae9ae2fdd9c4acd04f0feec916395eb03ace6bc1))
* add toast notifications for adding/removing articles to/from Read Later list ([b53f0d0](https://github.com/marcusleg/briefing-officer/commit/b53f0d0b10c5023ede953068dd1d0ac0ad9eaef0))
* add toast notifications for starring/unstarring articles ([f0c78d4](https://github.com/marcusleg/briefing-officer/commit/f0c78d4f4dfb5063c99eee55b015d50c80e8ecfe))
* add tooltip to `DeleteFeedButton` ([e3a6bf5](https://github.com/marcusleg/briefing-officer/commit/e3a6bf57271d2adbb1cbbaecfba58c77bc27ff8f))
* add tooltip to `EditFeedButton` ([6bac54f](https://github.com/marcusleg/briefing-officer/commit/6bac54fa9e4ce9895d27f33ea669995f118aa7dd))
* add user activation status and ban/unban functionality in UserTable ([a7343b2](https://github.com/marcusleg/briefing-officer/commit/a7343b28427c755cf9c46bcb98cc06857f821f90))
* add user-based filtering to article and feed stats queries ([2cd28c3](https://github.com/marcusleg/briefing-officer/commit/2cd28c366c0c5058c6217fe9115565b65f0e72aa))
* allow self-registration by default, but disallow sign-ins until account approved by administrator ([9095c56](https://github.com/marcusleg/briefing-officer/commit/9095c56ca0216253e423636bbdfe133c7bc10c69))
* article search ([25426dd](https://github.com/marcusleg/briefing-officer/commit/25426ddabb244e644bafcb403f60b4bed3d38473))
* automatically assign `admin` role to first user ([569afff](https://github.com/marcusleg/briefing-officer/commit/569afff7fe1d72587a190a31334e8ab0ef9a79d0))
* automatically delete articles older than one year ([6afcd8c](https://github.com/marcusleg/briefing-officer/commit/6afcd8c7fa927b3f063fd9d9f07f5d86f0282b75))
* basic user management ([85faf01](https://github.com/marcusleg/briefing-officer/commit/85faf0193bacf1353f79887e2e3cd698122e1e95))
* calculate token costs dynamically by model ([bbcf748](https://github.com/marcusleg/briefing-officer/commit/bbcf748d7e78f7664531ca3d4282ee5cecd7fd1c))
* clicking the website title navigates to frontpage ([625cc0f](https://github.com/marcusleg/briefing-officer/commit/625cc0feb8bb19134364e3b6c799247675aa4261))
* dark mode auto-detect and toggle ([e974e55](https://github.com/marcusleg/briefing-officer/commit/e974e55891e3d215c9c2955a0f38c79db94267eb))
* darker dark theme ([e44ef43](https://github.com/marcusleg/briefing-officer/commit/e44ef433006ef9ed20e77379df195e49789f0755))
* disable self-registration by default after initial account was created ([8bf80d0](https://github.com/marcusleg/briefing-officer/commit/8bf80d04395f29d334cf0ffc8501d54fe6b28a4d))
* display a helpful message when no feeds were added yet ([833fa7c](https://github.com/marcusleg/briefing-officer/commit/833fa7ce45a6bf332f891e2c6ed39e375b49d04e))
* display article author in ArticleCard if available ([85d2260](https://github.com/marcusleg/briefing-officer/commit/85d226024f038f1fac4c936605d248c500a1f19d))
* display feed action buttons right of the feed title on large screens ([8652b7a](https://github.com/marcusleg/briefing-officer/commit/8652b7a8476b6f5ecc0949f9628085deebd79e02))
* display time of last update on feed page ([43a77be](https://github.com/marcusleg/briefing-officer/commit/43a77be526f18c23d5e916b2b4375de4b0fe14db))
* enhance AI summary prompt for improved structure and clarity ([329a583](https://github.com/marcusleg/briefing-officer/commit/329a583bf805a06b4bcf5472d7d0df83cb735180))
* enhance caching layer with QuickLRU for size-limited and time-bound storage ([c2cb87f](https://github.com/marcusleg/briefing-officer/commit/c2cb87feff6b714b83171d279ea00aaff9798f3b))
* feed categories ([86f535e](https://github.com/marcusleg/briefing-officer/commit/86f535e731bc902f4b0d59de912049bfea2028cd))
* generate AI lead on demand if not found in database ([da26228](https://github.com/marcusleg/briefing-officer/commit/da26228a262cce1d36e79de34b6101a3ac64db48))
* generate AI lead right after the article is scraped ([b28455d](https://github.com/marcusleg/briefing-officer/commit/b28455d3a8296819369de65bc6a871f29d4f3644))
* hide articles marked for "read later" from feeds ([152c5dd](https://github.com/marcusleg/briefing-officer/commit/152c5ddf7df91a7b8ec975d0a0bb0b7c8c3d1de7))
* hide frontpage charts on small screen ([8f6fa30](https://github.com/marcusleg/briefing-officer/commit/8f6fa300913683957787e42a29f2da9648eb13db))
* implement authentication flows with `better-auth` ([60a3334](https://github.com/marcusleg/briefing-officer/commit/60a33346816828932c9049021a6453918263d9d1))
* improve AI summary prompt ([ae485b3](https://github.com/marcusleg/briefing-officer/commit/ae485b3834a5208455aaba73ddc130c19151950c))
* improve AI summary prompt ([9889da6](https://github.com/marcusleg/briefing-officer/commit/9889da61ac99eb6a08635b8db6ec5edad8245e38))
* improve bulk mark as read action ([eaec253](https://github.com/marcusleg/briefing-officer/commit/eaec25368c48c637aa47ab45db2bec5bf604313e))
* improve frontpage dashboard ([#232](https://github.com/marcusleg/briefing-officer/issues/232)) ([e90f830](https://github.com/marcusleg/briefing-officer/commit/e90f830287ee743b8deb306975da2b822bbfa45e))
* improve message when no unread articles to display in a feed, link to All Feeds ([125e5a0](https://github.com/marcusleg/briefing-officer/commit/125e5a07b1af5c57cfc7f1152f1976218df6f36c))
* improve message when no unread articles to display, link to Read Later ([94c7b9a](https://github.com/marcusleg/briefing-officer/commit/94c7b9a1c54392bfe23eb5bcfb5ad2838b301fcc))
* integrate `better-auth` with Prisma and Next.js ([d3ff7aa](https://github.com/marcusleg/briefing-officer/commit/d3ff7aa337eea7250414559040442817c55366ae))
* introduce system prompt for AI summary and lead generation ([37d34f3](https://github.com/marcusleg/briefing-officer/commit/37d34f3be657ff2188f07f5140717d43a37a5d1b))
* lazy-load AI leads to avoid unnecessary LLM invocations ([2189ee7](https://github.com/marcusleg/briefing-officer/commit/2189ee742b1961a21184b1d6f5c10303c8274a53))
* limit completion tokens for AI Lead generation ([842a566](https://github.com/marcusleg/briefing-officer/commit/842a56693953449d223a97fcfbbffb6164c0187c))
* limit max width and center ArticleCard ([455f9ba](https://github.com/marcusleg/briefing-officer/commit/455f9ba04646cea58135cbab74d346e9fc7948c1))
* log AI token usage ([e3b6bd1](https://github.com/marcusleg/briefing-officer/commit/e3b6bd1be3f614ac552684ded64e6bbd7b137b3d))
* make New Articles Chart a stacked bar chart ([9832c93](https://github.com/marcusleg/briefing-officer/commit/9832c9332a8ccb0fab67b3e42a9083b13e1c84b9))
* make New Articles Chart a stacked bar chart ([4a9099f](https://github.com/marcusleg/briefing-officer/commit/4a9099f3730065f3c670d2106eb4f5f6b23076c4))
* migrate from Buildah to Docker ([1c43447](https://github.com/marcusleg/briefing-officer/commit/1c43447ec158ff4293a0674992345eabbbedc3d9))
* more conventional path for Article AI Summary page ([cd0f639](https://github.com/marcusleg/briefing-officer/commit/cd0f639889158d38c34971f4d06f3134371764ad))
* move relative time of last feed update to feed subtitle ([7ba18a9](https://github.com/marcusleg/briefing-officer/commit/7ba18a9479978c7c2fccec5d0196d487e3bdb598))
* new navigation bar based on `sidebar` ([2cb41a3](https://github.com/marcusleg/briefing-officer/commit/2cb41a3989b31375c0aad24d4c6f4c6fcb0d8667))
* read database URL from environment ([b0818e3](https://github.com/marcusleg/briefing-officer/commit/b0818e39ed881b158d9af0f31a59fb17672f5968))
* redesign All Feeds page title section ([7999997](https://github.com/marcusleg/briefing-officer/commit/799999784b23b492516727630da3db7f03c43f67))
* redesign feed title, refactor into reusable component ([c1493f7](https://github.com/marcusleg/briefing-officer/commit/c1493f7affbd35516522800e3c0a8ad4a738ed2c))
* redesign of article cards ([3351166](https://github.com/marcusleg/briefing-officer/commit/33511660c11414c617cc2a50fe7e77602afdff12))
* refine AI lead prompt and add token limit for better control ([56fa732](https://github.com/marcusleg/briefing-officer/commit/56fa73267bd3241a449d979431d4a0b10364b814))
* remove articles marked as read from "Read Later" ([a41c299](https://github.com/marcusleg/briefing-officer/commit/a41c299a9fdf09b6d331281c86b94a9575a004ae))
* remove AWS Bedrock code and SDK ([4fb64e1](https://github.com/marcusleg/briefing-officer/commit/4fb64e179bf7f95d7edc772705ed1e1664d8e747))
* replace `Typography` with semantic `<h2>` in multiple pages ([becc2ac](https://github.com/marcusleg/briefing-officer/commit/becc2ac82f22877581bbe74784c6232f379dbee1))
* secure cron API with environment-based token validation ([d128693](https://github.com/marcusleg/briefing-officer/commit/d128693d285afaf2e6ed1984fa054e0aa82533f1))
* show a message on frontpage when no unread articles are available ([1d769b1](https://github.com/marcusleg/briefing-officer/commit/1d769b142656320d857b229307dd91564eca92db))
* show article metadata on AI summary page ([f799ffc](https://github.com/marcusleg/briefing-officer/commit/f799ffc4a00a1d0a9375583e2ca0870078721b22))
* spoof Firefox user agent when scraping articles ([69f0571](https://github.com/marcusleg/briefing-officer/commit/69f05715ff89a1b85bc5ca0c0e4f757527ce578d))
* stream AI leads for improved performance ([6a60cda](https://github.com/marcusleg/briefing-officer/commit/6a60cda5a65248c73dd9168cc30f7f903cfc452b))
* stream AI summaries for faster page loads ([574e195](https://github.com/marcusleg/briefing-officer/commit/574e19530d2a38c6127953becd34db0fbea3cfb6))
* track and persist token usage in AI operations ([fd7328d](https://github.com/marcusleg/briefing-officer/commit/fd7328d4fd65da55d6b267f87ab3cf02e0a6818f))
* tweak padding and margins in base layout ([fb193fc](https://github.com/marcusleg/briefing-officer/commit/fb193fc5bdf94277707a6bf3ad994d6151a1c5ed))
* update AI summary prompt to generate longer summaries ([7d209ca](https://github.com/marcusleg/briefing-officer/commit/7d209ca1a941bee70df06dccb23a84870914d39a))
* use GPT-5-nano and update AI SDK ([ad48ce1](https://github.com/marcusleg/briefing-officer/commit/ad48ce19837a08e862ae9b3ce09b83550588a55f))
* use OpenAI to generate leads and summaries ([7047f1b](https://github.com/marcusleg/briefing-officer/commit/7047f1bc48a2f1596f08a91ccfd8503948a3e445))
* WIP login form ([2bd9045](https://github.com/marcusleg/briefing-officer/commit/2bd904581ccfa687b84a9cf91cb6c8eea3fc8cfb))
* WIP non-functional burger menu button ([4bef77b](https://github.com/marcusleg/briefing-officer/commit/4bef77b258b32e1c7c8e427d8213eaa565126315))


### Bug Fixes

* `outline` conflicted with `border` inherited from `<Card />` ([3c715c6](https://github.com/marcusleg/briefing-officer/commit/3c715c63080c731fe81d08d58973d56e4e78ef0a))
* add base URL to `.env.example` ([85957b5](https://github.com/marcusleg/briefing-officer/commit/85957b5fcf1c99e1111f6a49f667c4bb32c1b487))
* add breadcrumb segments to `TopNavigation` in key pages ([a4e97c6](https://github.com/marcusleg/briefing-officer/commit/a4e97c688c05caea89fa7e1c062808249910ba74))
* add environment variables to build CI job ([efa5855](https://github.com/marcusleg/briefing-officer/commit/efa58559ca0efb3cf29673f7e2c356ae2686e3c6))
* add environment variables to container build stage ([ccddf76](https://github.com/marcusleg/briefing-officer/commit/ccddf761506b4e952688b309eb28850603a994a2))
* add missing dependency array ([ec503eb](https://github.com/marcusleg/briefing-officer/commit/ec503ebff3df7bf753b08a47ffe0a99781b0b645))
* adjust article card and list spacing ([9323793](https://github.com/marcusleg/briefing-officer/commit/93237932d1b2a0625c753a1bf49e653f930d6d48))
* adjust grid layout in dashboard to use single column on smaller screens ([5a449c0](https://github.com/marcusleg/briefing-officer/commit/5a449c0e5673f5e48917a026106f3f2c033b9fa0))
* align design of Feed Category page with the rest of the site ([f3f3890](https://github.com/marcusleg/briefing-officer/commit/f3f3890de48014adf977163f604889c0d69cbd1d))
* align design of Token Usage Chart with the other bar charts ([a8fd220](https://github.com/marcusleg/briefing-officer/commit/a8fd220fbe1baa47f9f7eba0bb3168cc82eff00d))
* align title design of Search Result Page with the rest of the site ([50b62e8](https://github.com/marcusleg/briefing-officer/commit/50b62e8633064d4550d82c1e142d6ee534e5e01c))
* await feed refreshing to fix `revalidatePath()` calls ([f29ea59](https://github.com/marcusleg/briefing-officer/commit/f29ea590dbb294cf1eb11762a8856494007d4bdb))
* call correct Promise method ([5609a02](https://github.com/marcusleg/briefing-officer/commit/5609a026397b1825ef992b8e30907598c3aea234))
* center dashboard date range toggle ([9277f16](https://github.com/marcusleg/briefing-officer/commit/9277f16a7b5ead80aeb831588aef1fc8f911a810))
* checking the user ID in `feedRepository.ts` breaks the `/api/cron` endpoint ([66c5287](https://github.com/marcusleg/briefing-officer/commit/66c5287021d9c92f6c00be0b850f4d573e29bcc7))
* checking the user ID in `generateAiLead()` breaks the `/api/cron` endpoint ([d780fa4](https://github.com/marcusleg/briefing-officer/commit/d780fa4c1383b9c14ce426b515c202187092dcca))
* conditionally render author in ArticleCard ([571b975](https://github.com/marcusleg/briefing-officer/commit/571b97531dae780aaaa1a5affec06e2b14074cde))
* correct heading of starred articles page ([9e5306c](https://github.com/marcusleg/briefing-officer/commit/9e5306c4f3b1c1997396107a3f15092dd38ad642))
* correct media queries in feed dashboard ([a8deb6f](https://github.com/marcusleg/briefing-officer/commit/a8deb6fbdc4f252c0e568f90bfea905ab28b114b))
* correct rename that got lost during rebase ([f7f9928](https://github.com/marcusleg/briefing-officer/commit/f7f9928cfdbf39db5214424b198b91ae2e846cf9))
* correct unique constraints for feed and article links ([aa481cc](https://github.com/marcusleg/briefing-officer/commit/aa481ccaba775ae2034ff22131e248d805bdbb3f))
* **deps:** update dependency axios to v1.8.2 [security] ([#176](https://github.com/marcusleg/briefing-officer/issues/176)) ([e8ab707](https://github.com/marcusleg/briefing-officer/commit/e8ab7074121af2ef306b6914b73596ea50d65568))
* **deps:** update dependency jsdom to v26 ([c11d732](https://github.com/marcusleg/briefing-officer/commit/c11d7320aa2d2584b244520ec2cd6e5f9f6c2fa4))
* **deps:** update dependency lucide-react to ^0.451.0 ([3f52ed1](https://github.com/marcusleg/briefing-officer/commit/3f52ed121927f1a10e0dfff7fca07261f4a63682))
* **deps:** update dependency lucide-react to ^0.452.0 ([106d5b3](https://github.com/marcusleg/briefing-officer/commit/106d5b36371665d5f68b043b881822b2591d7095))
* **deps:** update dependency lucide-react to ^0.453.0 ([a8ea223](https://github.com/marcusleg/briefing-officer/commit/a8ea22379de8ceaf86464cbc974c44a27618d3cb))
* **deps:** update dependency lucide-react to ^0.460.0 ([#98](https://github.com/marcusleg/briefing-officer/issues/98)) ([099b49a](https://github.com/marcusleg/briefing-officer/commit/099b49ae6827ba295a1f0b9178417f5e3192aa8a))
* **deps:** update dependency lucide-react to ^0.461.0 ([#106](https://github.com/marcusleg/briefing-officer/issues/106)) ([bf9c16c](https://github.com/marcusleg/briefing-officer/commit/bf9c16c5b38c1077914090502b9ac257befb4dbd))
* **deps:** update dependency lucide-react to ^0.462.0 ([#110](https://github.com/marcusleg/briefing-officer/issues/110)) ([6b994c0](https://github.com/marcusleg/briefing-officer/commit/6b994c0a71fee315bf549bbe0e3952d068252474))
* **deps:** update dependency lucide-react to ^0.464.0 ([#117](https://github.com/marcusleg/briefing-officer/issues/117)) ([237c4b9](https://github.com/marcusleg/briefing-officer/commit/237c4b9fb17dd267d201ef53a02c86f92870a5ae))
* **deps:** update dependency lucide-react to ^0.465.0 ([#129](https://github.com/marcusleg/briefing-officer/issues/129)) ([0766c82](https://github.com/marcusleg/briefing-officer/commit/0766c82084ab94342ab954303599ba38689437c8))
* **deps:** update dependency lucide-react to ^0.466.0 ([#134](https://github.com/marcusleg/briefing-officer/issues/134)) ([1b61609](https://github.com/marcusleg/briefing-officer/commit/1b6160997bb32d503e68caf2014b3cc02b97dc20))
* **deps:** update dependency lucide-react to ^0.468.0 ([#135](https://github.com/marcusleg/briefing-officer/issues/135)) ([8d3921a](https://github.com/marcusleg/briefing-officer/commit/8d3921ac66a53d31f3df9d645d1b70e875a488db))
* **deps:** update dependency lucide-react to ^0.511.0 ([#147](https://github.com/marcusleg/briefing-officer/issues/147)) ([c205b71](https://github.com/marcusleg/briefing-officer/commit/c205b7159b927a25acf7e2ce67f9b60fde831723))
* **deps:** update dependency next to v14.2.25 [security] ([#150](https://github.com/marcusleg/briefing-officer/issues/150)) ([a2b6cce](https://github.com/marcusleg/briefing-officer/commit/a2b6cceba1b68256d626883c5c51c29768cc3187))
* **deps:** update dependency next to v14.2.26 [security] ([d690836](https://github.com/marcusleg/briefing-officer/commit/d690836dea42c7e727af5f8482af06f709cb1d0e))
* **deps:** update next to v14.2.29 ([#146](https://github.com/marcusleg/briefing-officer/issues/146)) ([5f80012](https://github.com/marcusleg/briefing-officer/commit/5f800123d57b6910a1a493fd9ac12a59474e9582))
* don't auto-focus the article search inout field ([6c33743](https://github.com/marcusleg/briefing-officer/commit/6c337431ef7cd22023c26e4dae96abc1b12bcac9))
* don't count read later articles towards sum of unread articles ([f81cfc4](https://github.com/marcusleg/briefing-officer/commit/f81cfc43e7c0c8180db5fbead7058b3242603958))
* enable experimental `authInterrupts` in Next.js configuration ([ba6d5d2](https://github.com/marcusleg/briefing-officer/commit/ba6d5d2fe389ab77e135d46b608ac44c52d1eb03))
* ensure `data/` directory exists when repo is cloned ([a3471f4](https://github.com/marcusleg/briefing-officer/commit/a3471f46252995ce00db374cdfe940b522b1ed82))
* ensure feed access is user-specific by validating session and user ID ([ae10760](https://github.com/marcusleg/briefing-officer/commit/ae107606215f7cc6ce7831dc2f53fe0ab5b8a73f))
* ensure router state refresh after sign-in and sign-out actions ([2d8c43d](https://github.com/marcusleg/briefing-officer/commit/2d8c43de35d5163dbd28cb0ff59cc7362118a4aa))
* filter by user ID in article search ([fea5f26](https://github.com/marcusleg/briefing-officer/commit/fea5f2638617155d55c8bc813e370819fe193fd4))
* fix `DATABASE_URL` environment variable in `build` CI job ([6f87195](https://github.com/marcusleg/briefing-officer/commit/6f871950004cb8a16668296ee3f244bb41289b38))
* fix container build ([72aee6d](https://github.com/marcusleg/briefing-officer/commit/72aee6d95ceb687eac72035edbbff35617e38b5e))
* fix tag in "Build and push" CI job ([c57fb0c](https://github.com/marcusleg/briefing-officer/commit/c57fb0c13775a8824b9f8602e80c9824e6423703))
* fix type errors I was too lazy to fix last time ([ccd247b](https://github.com/marcusleg/briefing-officer/commit/ccd247bbb47b1e82c79f17242af4bec9b3b6f35e))
* handle missing scrape content gracefully to prevent hallucinated leads based on the article title alone ([18a8a71](https://github.com/marcusleg/briefing-officer/commit/18a8a7187cc4df891720d563dc9b58e62c75f693))
* handle missing scrape content gracefully when generating AI summaries ([9d867be](https://github.com/marcusleg/briefing-officer/commit/9d867be82f66a35234d9ca08f3d7983dc9248ffd))
* hide dashboard date range selector on mobile ([84c17e3](https://github.com/marcusleg/briefing-officer/commit/84c17e30493e2277d8e29e67e91cc957d5e22914))
* homogenous page widths ([88dbb44](https://github.com/marcusleg/briefing-officer/commit/88dbb44b51fca212bca701cda6a780cde5883f74))
* improve error handling for article parsing in scraper ([9972701](https://github.com/marcusleg/briefing-officer/commit/997270136a6cd2440ca474056872a55ae9660c1e))
* improve sign-in error handling and UI feedback ([fe99de0](https://github.com/marcusleg/briefing-officer/commit/fe99de0f13abb9ecd84f569aa79b621e92ea5a06))
* log into ghcr.io in contaimer-image pipeline ([a5ee083](https://github.com/marcusleg/briefing-officer/commit/a5ee0831216f93f9d7ae8c06ae66e1be7db7d59b))
* move `ARTICLE_RETENTION_DAYS` constant to shared `constants.ts` file ([edf514a](https://github.com/marcusleg/briefing-officer/commit/edf514aae41093147856964d9e032db7591d99a1))
* only display personal feeds in left navigation ([77fcdc9](https://github.com/marcusleg/briefing-officer/commit/77fcdc900b89d979c6e1a1c5da3c98326914e431))
* prevent multiple AI summary streams in strict mode ([3323fa7](https://github.com/marcusleg/briefing-officer/commit/3323fa7fb921363a6baf8b56b4edd8da98450b55))
* prevent two AI lead streams running in parallel in strict mode ([f8360bd](https://github.com/marcusleg/briefing-officer/commit/f8360bdd46ce239eeaa7c4bb703285429c046d19))
* properly escape apostrophe ([e3c6de7](https://github.com/marcusleg/briefing-officer/commit/e3c6de7ca194a9dfda889250144dfa068a884385))
* remove `className` prop in ArticleMeta component ([4d5cfaf](https://github.com/marcusleg/briefing-officer/commit/4d5cfafdb1d92d45f0d3f9bdcf3c3cf27f0d0517))
* remove `unauthorized()` ([5cd51e0](https://github.com/marcusleg/briefing-officer/commit/5cd51e0580c918a0e6bb3aeb37f5e65e4f5aaae1))
* remove cursor-pointer from ArticleCard ([4dabb60](https://github.com/marcusleg/briefing-officer/commit/4dabb60bfdbbb4b42c9df809538b1172bef35e01))
* remove pointless `activeIndex` prop from charts ([15cf6d5](https://github.com/marcusleg/briefing-officer/commit/15cf6d5f8a78beabf3f5d5f7368dcf6808342b4a))
* replace null returns with unauthorized or notFound responses for improved navigation handling ([575fa51](https://github.com/marcusleg/briefing-officer/commit/575fa51c5d573ab848134651996a0a0937dfcbda))
* restrict feed actions to authenticated user ([c5b69a7](https://github.com/marcusleg/briefing-officer/commit/c5b69a77e88184679b966cba088c3b1430e7cf4a))
* shorter button text for better support on small screens ([828a3ed](https://github.com/marcusleg/briefing-officer/commit/828a3ed958c8c2025709f707ebb85d6eda08707e))
* show pointer when hovering buttons ([76285ee](https://github.com/marcusleg/briefing-officer/commit/76285ee768323caf1c421187e15cae0cacc9418e))
* specify Containerfile in "Build and push" CI job ([30ba112](https://github.com/marcusleg/briefing-officer/commit/30ba11221ecc0cda703002d84662da69d15f4d7a))
* split top left navigation into server-side and client-side components to fix UI updates when marking articles as read/read later ([b4b57db](https://github.com/marcusleg/briefing-officer/commit/b4b57dbaf15ae0d0ff81efc440dd41daea2fe7a2))
* tweak chart colors ([d53f2fe](https://github.com/marcusleg/briefing-officer/commit/d53f2fe75a017691529e5a1d9867fef3d92df9e3))
* update breadcrumb navigation to use "My Feed" instead of "Home" ([a2df7ae](https://github.com/marcusleg/briefing-officer/commit/a2df7aefdf8e1085f2b7ad5489c898bc737fd885))
* update environment variables in Containerfile and `.env.example` ([c964d29](https://github.com/marcusleg/briefing-officer/commit/c964d299bcb56b26b5de7ed7bb728a97e4dc4844))
* update revalidatePath calls to target "/feed" ([fa0bb02](https://github.com/marcusleg/briefing-officer/commit/fa0bb02cd00dc961fb731a4c7285b34ad0ad2af6))
* use `asChild` prop for `TooltipTrigger` in feed buttons ([157aeff](https://github.com/marcusleg/briefing-officer/commit/157aeff5bee4be84d56f67a579ef38a569fccb88))


### Reverts

* correct media queries in feed dashboard ([8cd5680](https://github.com/marcusleg/briefing-officer/commit/8cd568034fbfd750026a0104346080762df60780))
* display article author in ArticleCard if available ([b327a33](https://github.com/marcusleg/briefing-officer/commit/b327a333985a78be539bca4d5b6f3aa4ea099bf9))
