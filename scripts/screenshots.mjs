import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const OUT_DIR = "assets/screenshots";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const assetPath = `file://${process.cwd().replace(/\\/g, "/")}`;

  // --- 1. Terminal screenshot (cropped to first 75 lines) ---
  const terminalTxt = readFileSync("assets/demo/risky-terminal.txt", "utf-8").trimEnd();
  const preview = terminalTxt.split("\n").slice(0, 75).join("\n");
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
</style></head><body><div class="terminal"><div class="titlebar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="title-text">bash — repoproof scan risky-demo-repo</span></div><div class="content"><span class="cmd">$ npx repoproof scan risky-demo-repo</span>${preview.replace(/\n/g, '<br>').replace(/Overall Score: (\d+\.\d\/100)/, (_, s) => `Overall Score: <span class="score">${s}</span>`).replace(/Grade:\s+F/, 'Grade:        <span class="grade">F</span>').replace(/ERROR \((\d+)\)/, (_, n) => `ERROR (<span class="error">${n}</span>)`).replace(/WARNING \((\d+)\)/, (_, n) => `WARNING (<span class="warning">${n}</span>)`).replace(/INFO \((\d+)\)/, (_, n) => `INFO (<span class="info">${n}</span>)`).replace(/\[ERROR\]/g, '<span class="error">[ERROR]</span>').replace(/\[WARNING\]/g, '<span class="warning">[WARNING]</span>').replace(/\[INFO\]/g, '<span class="info">[INFO]</span>')}</div></div></body></html>`;
  writeFileSync(`${OUT_DIR}/terminal-page.html`, terminalHtml);

  const termPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await termPage.goto(`${assetPath}/assets/screenshots/terminal-page.html`);
  await termPage.waitForSelector(".terminal");
  const termBox = await termPage.locator(".terminal").boundingBox();
  await termPage.setViewportSize({ width: 1280, height: Math.ceil(termBox.y + termBox.height + 40) });
  await termPage.waitForTimeout(300);
  await termPage.locator(".terminal").screenshot({ path: `${OUT_DIR}/terminal-scan.png` });
  console.log("terminal-scan.png saved");
  await termPage.close();

  // --- 2. Self-scan report screenshot ---
  const selfScanHtml = readFileSync("assets/demo/self-scan-report.html", "utf-8")
    .replace('data-theme="light"', 'data-theme="dark"');

  const selfPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await selfPage.setContent(selfScanHtml, { waitUntil: "networkidle" });
  await selfPage.waitForTimeout(800);
  const selfHeight = await selfPage.evaluate(() => document.documentElement.scrollHeight);
  await selfPage.setViewportSize({ width: 1440, height: Math.min(selfHeight, 4000) });
  await selfPage.waitForTimeout(300);
  await selfPage.screenshot({ path: `${OUT_DIR}/self-scan-report.png`, fullPage: true });
  console.log("self-scan-report.png saved");
  await selfPage.close();

  // --- 3. Risky demo report screenshot (with banner) ---
  const riskyRaw = readFileSync("assets/demo/repoproof-report.html", "utf-8")
    .replace('data-theme="light"', 'data-theme="dark"');
  const styleMatch = riskyRaw.match(/<style>[\s\S]*?<\/style>/);
  const bodyMatch = riskyRaw.match(/<body>[\s\S]*?<\/body>/);
  const styles = styleMatch ? styleMatch[0] : "";
  const bodyContent = bodyMatch ? bodyMatch[0].replace(/<\/?body>/g, "") : "";

  const riskWrapper = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Risky Demo Report</title>
${styles}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--color-bg, #1a1a2e); font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif); }
  .demo-banner {
    background: linear-gradient(135deg, #4a0000 0%, #6b0000 50%, #4a0000 100%);
    border-bottom: 3px solid #ff1744;
    color: #fff;
    text-align: center;
    padding: 18px 24px;
    position: sticky;
    top: 0;
    z-index: 9999;
  }
  .demo-banner h2 { font-size: 22px; letter-spacing: 1.5px; margin-bottom: 6px; text-transform: uppercase; }
  .demo-banner p { font-size: 14px; color: #ffcdd2; margin: 0; }
</style>
</head>
<body>
<div class="demo-banner">
  <h2>&#x26A0; Intentionally Risky Demo Repository</h2>
  <p>This is test data created to demonstrate RepoProof findings — not a real project.</p>
</div>
${bodyContent}
</body>
</html>`;

  const riskPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await riskPage.setContent(riskWrapper, { waitUntil: "networkidle" });
  await riskPage.waitForTimeout(800);
  const riskHeight = await riskPage.evaluate(() => document.documentElement.scrollHeight);
  await riskPage.setViewportSize({ width: 1440, height: Math.min(riskHeight, 6000) });
  await riskPage.waitForTimeout(300);
  await riskPage.screenshot({ path: `${OUT_DIR}/risky-demo-report.png`, fullPage: true });
  console.log("risky-demo-report.png saved");
  await riskPage.close();

  await browser.close();
  console.log("Done");
}

main().catch(console.error);
