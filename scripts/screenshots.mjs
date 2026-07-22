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

  // ── 2. Risky demo: banner + score + summary + categories + 5 findings ──
  const riskHtml = readFileSync("assets/demo/repoproof-report.html", "utf-8")
    .replace('data-theme="light"', 'data-theme="dark"');

  const riskPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await riskPage.setContent(riskHtml, { waitUntil: "networkidle" });
  await riskPage.waitForTimeout(500);

  // Trim to 5 findings and add banner via DOM
  await riskPage.evaluate(() => {
    // Remove filters
    const filters = document.querySelector(".filters");
    if (filters) filters.remove();

    // Keep only first 5 rows in findings table
    const tbody = document.querySelector("#findingsBody");
    if (tbody) {
      const rows = tbody.querySelectorAll("tr");
      for (let i = 5; i < rows.length; i++) {
        rows[i].remove();
      }
    }

    // Update visible count
    const vc = document.getElementById("visibleCount");
    if (vc) vc.textContent = "5 visible";

    // Add banner at the top of body
    const banner = document.createElement("div");
    banner.className = "demo-banner";
    banner.innerHTML =
      '<h2>&#x26A0; Intentionally Broken Demo</h2>' +
      '<p>This is test data created to demonstrate RepoProof findings \u2014 not a real project.</p>';
    banner.style.cssText =
      "background:linear-gradient(135deg,#3a0000 0%,#5a0000 50%,#3a0000 100%);" +
      "border-bottom:3px solid #ff1744;color:#fff;text-align:center;padding:14px 20px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;";
    const h2 = banner.querySelector("h2");
    if (h2) h2.style.cssText = "font-size:20px;letter-spacing:1.5px;margin:0 0 4px;text-transform:uppercase;";
    const p = banner.querySelector("p");
    if (p) p.style.cssText = "font-size:13px;color:#ffcdd2;margin:0;";
    document.body.insertBefore(banner, document.body.firstChild);

    // Remove any container margin-top that might create extra gap
    const container = document.querySelector(".container");
    if (container) container.style.marginTop = "0";
  });
  await riskPage.waitForTimeout(200);

  // Clip to body content (banner + score + summary + categories + 5 findings)
  const riskBox = await riskPage.locator("body").boundingBox();
  if (riskBox) {
    const h = Math.min(Math.ceil(riskBox.height), 900);
    await riskPage.screenshot({
      path: `${OUT}/repoproof-risky-demo.png`,
      clip: { x: riskBox.x, y: riskBox.y, width: Math.min(riskBox.width, 1440), height: h },
    });
  }
  console.log("repoproof-risky-demo.png saved");
  await riskPage.close();

  await browser.close();
  console.log("Done");
}

main().catch(console.error);
