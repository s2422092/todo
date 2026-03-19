const puppeteer = require('puppeteer');
const path = require('path');

const shots = [
  { file: 'mock-1-popup.html',   out: 'screenshot-1-popup.jpg' },
  { file: 'mock-2-taskbar.html', out: 'screenshot-2-taskbar.jpg' },
  { file: 'mock-3-drag.html',    out: 'screenshot-3-drag.jpg' },
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  for (const s of shots) {
    const url = 'file://' + path.join(__dirname, s.file);
    await page.goto(url, { waitUntil: 'networkidle0' });
    const outPath = path.join(__dirname, s.out);
    await page.screenshot({
      path: outPath,
      type: 'jpeg',
      quality: 95,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
      omitBackground: false,
    });
    console.log('Saved:', s.out);
  }

  await browser.close();
})();
