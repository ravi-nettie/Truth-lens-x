const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\80f23523-22d8-4f34-9c73-6a195365ae5c';

const pagesToTest = [
  { url: 'http://127.0.0.1:8000/cases/case_a78c7b6ce07b', name: 'verified_image_dashboard_8000' },
  { url: 'http://127.0.0.1:8000/cases/case_a78c7b6ce07b/report', name: 'verified_image_report_8000' },
  { url: 'http://127.0.0.1:8000/cases/case_f3f76e20aa8e', name: 'verified_video_dashboard_8000' },
  { url: 'http://127.0.0.1:8000/cases/case_f3f76e20aa8e/report', name: 'verified_video_report_8000' },
  { url: 'http://127.0.0.1:8000/', name: 'verified_landing_8000' },
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    userDataDir: path.join(os.tmpdir(), 'puppeteer_' + Date.now()),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  for (const item of pagesToTest) {
    try {
      await page.goto(item.url, { waitUntil: 'networkidle0', timeout: 15000 });
      // wait extra 1s for any async state to paint
      await new Promise(r => setTimeout(r, 1000));
      const p = path.join(outDir, `${item.name}.png`);
      await page.screenshot({ path: p, fullPage: false });
      console.log(`Saved ${p}`);
    } catch (e) {
      console.error(`Failed ${item.url}:`, e.message);
    }
  }

  await browser.close();
  console.log('Verification screenshots captured successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
