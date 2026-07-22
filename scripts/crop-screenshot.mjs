import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
  const terminalTxt = readFileSync("assets/demo/risky-terminal.txt", "utf-8").trimEnd();

  // Only show the first ~50 lines: score, summary, first few findings, category breakdown
  const lines = terminalTxt.split("\n");
  const preview = lines.slice(0, 75).join("\n");

  const terminalHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1b26;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Cascadia Code','Fira Code','JetBrains Mono','Consolas',monospace}
.terminal{background:#0f0f14;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6);width:960px;overflow:hidden}
.titlebar{background:#1e1e2e;padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #313244}
.dot{width:12px;height:12px;border-radius:50%}
.dot.r{background:#f38ba8}.dot.y{background:#f9e2af}.dot.g{background:#a6e3a1}
.title-text{color:#6c7086;font-size:13px;margin-left:8px}
.content{background:#0f0f14;padding:20px 24px;color:#cdd6f4;font-size:14px;line-height:1.55;white-space:pre;overflow-x:auto}
.cmd{color:#89b4fa;font-weight:600;margin-bottom:8px;display:block}
.grade-f{color:#f38ba8;font-weight:700}
.label{color:#6c7086}
</style></head><body><div class="terminal"><div class="titlebar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="title-text">bash — repoproof scan risky-demo-repo</span></div><div class="content"><span class="cmd">$ npx repoproof scan risky-demo-repo</span>${preview.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div></body></html>`;

  writeFileSync("assets/screenshots/terminal-page.html", terminalHtml);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`file://${process.cwd().replace(/\\/g, "/")}/assets/screenshots/terminal-page.html`);
  await page.waitForSelector(".terminal");
  await page.waitForTimeout(300);
  const termBox = await page.locator(".terminal").boundingBox();
  await page.setViewportSize({ width: 1280, height: Math.ceil(termBox.y + termBox.height + 40) });
  await page.waitForTimeout(200);
  await page.locator(".terminal").screenshot({ path: "assets/screenshots/terminal-scan.png" });
  console.log("terminal-scan.png saved");

  await page.close();
  await browser.close();

  // Clean up temp file
  try { require("fs").unlinkSync("assets/screenshots/terminal-page.html"); } catch {}
}

main().catch(console.error);
