const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80f23523-22d8-4f34-9c73-6a195365ae5c';

const landingViewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1440', width: 1440, height: 900 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const desktopPages = [
  { url: 'http://localhost:3000/cases/new', name: 'after_newcase_1920' },
  { url: 'http://localhost:3000/history', name: 'after_history_1920' },
  { url: 'http://localhost:3000/cases/case_campus_tech_fest_2026', name: 'after_dashboard_1920' },
  { url: 'http://localhost:3000/cases/case_campus_tech_fest_2026/graph', name: 'after_graph_1920' },
  { url: 'http://localhost:3000/cases/case_campus_tech_fest_2026/timeline', name: 'after_timeline_1920' },
  { url: 'http://localhost:3000/cases/case_campus_tech_fest_2026/report', name: 'after_report_1920' },
];

const os = require('os');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    userDataDir: path.join(os.tmpdir(), 'puppeteer_' + Date.now()),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // 1. Capture landing page across all 5 viewports
  for (const vp of landingViewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 15000 });
    const p = path.join(outDir, `after_landing_${vp.name}.png`);
    await page.screenshot({ path: p });
    console.log(`Saved ${p}`);
  }

  // 2. Capture core desktop views at 1920x1080
  await page.setViewport({ width: 1920, height: 1080 });
  for (const item of desktopPages) {
    try {
      await page.goto(item.url, { waitUntil: 'networkidle0', timeout: 15000 });
      const p = path.join(outDir, `${item.name}.png`);
      await page.screenshot({ path: p });
      console.log(`Saved ${p}`);
    } catch (e) {
      console.error(`Error on ${item.url}:`, e.message);
    }
  }

  await browser.close();
  console.log('All screenshots completed successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
