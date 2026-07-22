import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const OUT = "assets/screenshots";

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── 1. Self-audit: summary + category cards, no findings ──────────
  const selfHtml = readFileSync("assets/demo/self-scan-report.html", "utf-8")
    .replace('data-theme="light"', 'data-theme="dark"');

  const selfPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await selfPage.setContent(selfHtml, { waitUntil: "networkidle" });
  await selfPage.waitForTimeout(500);

  // Remove the findings section and filters
  await selfPage.evaluate(() => {
    const sec = document.querySelector(".findings-section");
    if (sec) sec.remove();
    const filters = document.querySelector(".filters");
    if (filters) filters.remove();
  });
  await selfPage.waitForTimeout(200);

  // Clip to container height (should be well under 900)
  const selfBox = await selfPage.locator(".container").boundingBox();
  if (selfBox) {
    const h = Math.min(Math.ceil(selfBox.height), 900);
    await selfPage.screenshot({
      path: `${OUT}/repoproof-self-audit.png`,
      clip: { x: selfBox.x, y: selfBox.y, width: Math.min(selfBox.width, 1440), height: h },
    });
  }
  console.log("repoproof-self-audit.png saved");
  await selfPage.close();

  await browser.close();
  console.log("Done");
}

main().catch(console.error);
