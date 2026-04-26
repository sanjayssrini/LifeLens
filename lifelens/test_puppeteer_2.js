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
    console.log('PAGE CRASH:', error.message);
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
  
  // Open Chat
  try {
     const chatBtn = await page.$('button:has-text("Continue in chat")') || await page.$('button');
     // let's just find the Continue in chat button
     const buttons = await page.$$('button');
     for (let b of buttons) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text.includes('Continue in chat')) {
           await b.click();
           break;
        }
     }
  } catch (e) {}

  await new Promise(r => setTimeout(r, 1000));

  console.log("Typing 'im in danger'");
  try {
     await page.type('textarea', 'im in danger');
     const sendBtn = await page.$('button[type="submit"]');
     if(sendBtn) await sendBtn.click();
  } catch (e) {
     console.log("Error typing:", e);
  }

  console.log("Waiting 10 seconds to see if a crash occurs...");
  await new Promise(r => setTimeout(r, 10000));
  console.log("Done");
  await browser.close();
})();
