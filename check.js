import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERR:', response.status(), response.url());
    }
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await browser.close();
})();
