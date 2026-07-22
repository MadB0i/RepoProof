import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const OUT_DIR = "assets/screenshots";

function wrapScreenshot(page, file, opts = {}) {
  return page.screenshot({ path: `${OUT_DIR}/${file}`, fullPage: false, ...opts });
}

async function main() {
  const terminalTxt = readFileSync("assets/demo/risky-terminal.txt", "utf-8").trimEnd();

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
.score{color:#a6e3a1;font-weight:700}
.score-low{color:#f38ba8;font-weight:700}
.grade{color:#f38ba8;font-weight:700}
.grade-a{color:#a6e3a1}
.sep{color:#585b70}
.label{color:#6c7086}
.error{color:#f38ba8;font-weight:600}
.warning{color:#f9e2af;font-weight:600}
.info{color:#89b4fa;font-weight:600}
.findings{color:#bac2de}
</style></head><body><div class="terminal"><div class="titlebar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="title-text">bash — repoproof scan risky-demo-repo</span></div><div class="content"><span class="cmd">$ npx repoproof scan risky-demo-repo</span>${terminalTxt.replace(/\n/g, '<br>').replace(/Overall Score: (\d+\.\d\/100)/, (_, s) => `Overall Score: <span class="score">${s}</span>`).replace(/Grade:\s+F/, 'Grade:        <span class="grade">F</span>').replace(/ERROR \((\d+)\)/, (_, n) => `ERROR (<span class="error">${n}</span>)`).replace(/WARNING \((\d+)\)/, (_, n) => `WARNING (<span class="warning">${n}</span>)`).replace(/INFO \((\d+)\)/, (_, n) => `INFO (<span class="info">${n}</span>)`).replace(/\[ERROR\]/g, '<span class="error">[ERROR]</span>').replace(/\[WARNING\]/g, '<span class="warning">[WARNING]</span>').replace(/\[INFO\]/g, '<span class="info">[INFO]</span>')}</div></div></body></html>`;

  writeFileSync(`${OUT_DIR}/terminal-page.html`, terminalHtml);
  writeFileSync("assets/demo/terminal-page.html", terminalHtml);

  const browser = await chromium.launch({ headless: true });

  // Terminal screenshot
  const termPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await termPage.goto(`file://${process.cwd().replace(/\\/g, "/")}/assets/screenshots/terminal-page.html`);
  await termPage.waitForSelector(".terminal");
  const termBox = await termPage.locator(".terminal").boundingBox();
  await termPage.setViewportSize({ width: 1280, height: Math.ceil(termBox.y + termBox.height + 40) });
  await termPage.waitForTimeout(300);
  await termPage.locator(".terminal").screenshot({ path: `${OUT_DIR}/terminal-scan.png` });
  console.log("terminal-scan.png saved");
  await termPage.close();

  // HTML report screenshot
  const reportPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await reportPage.goto(`file://${process.cwd().replace(/\\/g, "/")}/assets/demo/repoproof-report.html`);
  await reportPage.waitForTimeout(800);
  // Get the full scroll height
  const bodyHeight = await reportPage.evaluate(() => document.documentElement.scrollHeight);
  await reportPage.setViewportSize({ width: 1440, height: Math.min(bodyHeight, 4000) });
  await reportPage.waitForTimeout(300);
  await reportPage.screenshot({ path: `${OUT_DIR}/html-report.png`, fullPage: true });
  console.log("html-report.png saved");
  await reportPage.close();

  await browser.close();
  console.log("Done");
}

main().catch(console.error);
