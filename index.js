const puppeteer = require("puppeteer");

const resumeHeadlineText = "Result driven professional having deep expertise in Frontend Development,Software Development Life Cycle,User Experience Design,Data Visualization,Agile Methodology,Code Quality Assurance,JavaScript,TypeScript,Material UI,Node.js,Python,SQL.";

const resumeHeadlineText2 = "Result driven professional having deep expertise in Frontend Development,Software Development Life Cycle,User Experience Design,Data Visualization,Agile Methodology,Code Quality Assurance,JavaScript,TypeScript,Material UI,Node.js,Python,SQL";

(async () => {
  console.log("🚀 Starting script...");

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    console.log("🌐 Opening login page...");
    await page.goto("https://www.naukri.com/nlogin/login", {
      waitUntil: "networkidle2"
    });

    console.log("🔐 Logging in...");
    await page.type("#usernameField", process.env.NAUKRI_EMAIL, { delay: 50 });
    await page.type("#passwordField", process.env.NAUKRI_PASSWORD, { delay: 50 });

    await Promise.all([
      page.click("button[type='submit']"),
      page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);

    console.log("📄 Navigating to profile...");
    await page.goto("https://www.naukri.com/mnjuser/profile", {
      waitUntil: "networkidle2"
    });

    console.log("✏️ Clicking edit...");
    await page.waitForSelector("#lazyResumeHead .edit", { timeout: 10000 });
    await page.click("#lazyResumeHead .edit");
    await page.waitForSelector("#resumeHeadline", { timeout: 10000 });
    const resumeHeadline = await page.$("#resumeHeadline");
    if (resumeHeadline) {
      console.log("📝 Updating resume headline...");
      await resumeHeadline.click({ clickCount: 3 });
        const currentValue = await page.evaluate(el => el.value, resumeHeadline);
        if(currentValue.length === resumeHeadlineText.length) {
            await resumeHeadline.type(resumeHeadlineText2, { delay: 50 });
        } else {
          await resumeHeadline.type(resumeHeadlineText, { delay: 50 });
        }
    } else {
      console.log("⚠️ Resume headline textarea not found, skipping...");
      await resumeHeadline.type("Experienced Software Engineer with expertise in Node.js and Puppeteer", { delay: 50 });
    }

    console.log("💾 Saving profile...");
    await page.click("button[type='submit']");

    await page.waitForTimeout(3000);

    console.log("✅ Profile updated successfully!");
  } catch (err) {
    console.error("❌ Error occurred:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed");
  }
})();