const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE UNCAUGHT EXCEPTION:', error.message);
  });

  await page.goto('http://localhost:5173');
  
  // click "Start Talking"
  try {
     await page.waitForSelector('button');
     const buttons = await page.$$('button');
     for (let b of buttons) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text.includes('Start Talking')) {
           await b.click();
           break;
        }
     }
  } catch (e) {}

  await new Promise(r => setTimeout(r, 2000));
  
  // Fill login
  try {
     await page.type('input[placeholder="Enter your name"]', 'TestUser');
     await page.keyboard.press('Enter');
  } catch (e) {}

  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Logged in.");
  
  // Try to click the SOS button directly
  try {
      const sosBtn = await page.$('button.bg-rose-500\\/20');
      if (sosBtn) {
          console.log("Found SOS button, clicking it.");
          await sosBtn.click();
      } else {
          console.log("SOS button not found by class, trying by text.");
          const buttons = await page.$$('button');
          for (let b of buttons) {
              const text = await page.evaluate(el => el.textContent, b);
              if (text.includes('SOS')) {
                  await b.click();
                  break;
              }
          }
      }
  } catch (e) {}

  console.log("Waiting 10 seconds to see if a crash occurs...");
  await new Promise(r => setTimeout(r, 10000));
  console.log("Done");
  await browser.close();
})();
