import prisma from "@/lib/prismaClient";
import { expect, test } from "./fixtures";

/**
 * Regression test for the article card overflowing the viewport on mobile.
 *
 * Reported symptom: on a phone the whole article card renders wider than the
 * screen, so every line (title and body) is clipped at the right edge and the
 * page scrolls horizontally. The bug does not manifest on desktop because the
 * wider screen hides the overflow.
 *
 * Root cause: AI-generated leads can contain non-breaking spaces (e.g. around a
 * comma-separated list of function names). With non-breaking spaces that whole
 * run becomes a single, very wide, otherwise-unbreakable token. The description
 * paragraph could not break it, so its intrinsic min-content grew far past the
 * viewport and dragged the card (and the surrounding flex layout) past the
 * screen edge.
 *
 * ` ` below is a NARROW NO-BREAK SPACE, reproducing the leads seen in
 * production. The fix (`wrap-anywhere` / overflow-wrap: anywhere on the
 * description) lets the run break so the card stays within the viewport.
 */

const NNBSP = " "; // narrow no-break space, as emitted by the AI lead
const LEAD_WITH_NONBREAKING_RUN =
  "Linux kernel version 7.2 removes the strncpy() API after six years of " +
  "effort and roughly 362 patches. The change eliminates all remaining uses " +
  "of strncpy in the kernel, addressing long-standing bugs linked to its " +
  "unintuitive null-termination semantics and performance overhead from " +
  "unnecessary zero-filling. Developers are now directed to use alternatives " +
  "such as " +
  `strscpy(),${NNBSP}strscpy_pad(),${NNBSP}strtomem_pad(),${NNBSP}` +
  `memcpy_and_pad()${NNBSP}or${NNBSP}memcpy()` +
  " for safe and efficient copying. The removal marks a major code-base cleanup.";

test.describe("article card", () => {
  test.describe("mobile", () => {
    // A common phone viewport (iPhone 12/13/14 width) — the bug is visible here.
    test.use({ viewport: { width: 390, height: 844 } });

    test("does not overflow the viewport", async ({ page }) => {
      const workerId = test.info().parallelIndex;
      const user = await prisma.user.findFirstOrThrow({
        where: { email: `e2e-worker-${workerId}@example.com` },
      });

      const feed = await prisma.feed.upsert({
        where: {
          userId_link: {
            userId: user.id,
            link: `https://example.com/overflow-feed-${workerId}`,
          },
        },
        create: {
          userId: user.id,
          title: "Overflow Feed",
          link: `https://example.com/overflow-feed-${workerId}`,
          lastFetched: new Date(),
        },
        update: {},
      });

      const articleLink = `https://example.com/overflow-article-${workerId}`;
      await prisma.article.deleteMany({
        where: { userId: user.id, feedId: feed.id, link: articleLink },
      });
      const article = await prisma.article.create({
        data: {
          userId: user.id,
          feedId: feed.id,
          title: "Linux kernel 7.2 removes the strncpy() API",
          link: articleLink,
          publicationDate: new Date(),
          scrape: {
            create: {
              textContent: LEAD_WITH_NONBREAKING_RUN,
              author: "Test Author",
            },
          },
          lead: { create: { text: LEAD_WITH_NONBREAKING_RUN } },
        },
      });

      await page.goto(`/feed/${feed.id}`);

      const card = page.locator('[data-slot="card"]').first();
      await expect(card).toBeVisible();
      await expect(card).toContainText("memcpy");

      const viewportWidth = page.viewportSize()!.width;

      // The card must not extend past the right edge of the viewport.
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);

      // And the page must not be horizontally scrollable.
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(0);

      // Cleanup so re-runs stay deterministic.
      await prisma.article.delete({ where: { id: article.id } });
    });
  });
});
