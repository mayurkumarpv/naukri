const puppeteer = require("puppeteer");

const resumeHeadlineText =
  "Result driven professional having deep expertise in Frontend Development, Software Development Life Cycle, User Experience Design, Data Visualization, Agile Methodology, Code Quality Assurance, JavaScript, TypeScript, Material UI, Node.js, SQL.";

const resumeHeadlineText2 =
  "Result driven professional having deep expertise in Frontend Development, Software Development Life Cycle, User Experience Design, Data Visualization, Agile Methodology, Code Quality Assurance, JavaScript, TypeScript, Material UI, Node.js, SQL";

(async () => {
  console.log("🚀 Starting script...");

  if (!process.env.NAUKRI_EMAIL || !process.env.NAUKRI_PASSWORD) {
    throw new Error(
      "Missing NAUKRI_EMAIL or NAUKRI_PASSWORD environment variables"
    );
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1366,768"
    ]
  });

  const page = await browser.newPage();

  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4] });
    globalThis.chrome = { runtime: {} };
  });

  try {
    // 🔐 LOGIN
    console.log("🌐 Opening login page...");
    await page.goto("https://www.naukri.com/nlogin/login", {
      waitUntil: "networkidle2"
    });

    console.log("🔐 Logging in...");
    await page.waitForSelector("#usernameField", { timeout: 15000 });
    await page.click("#usernameField", { clickCount: 3 });
    await page.type("#usernameField", process.env.NAUKRI_EMAIL, { delay: 50 });

    await page.waitForSelector("#passwordField", { timeout: 15000 });
    await page.click("#passwordField", { clickCount: 3 });
    await page.type("#passwordField", process.env.NAUKRI_PASSWORD, { delay: 50 });

    await page.click("button[type='submit']");

    // In headless CI, login may not trigger a full navigation immediately.
    // Wait for either URL change or disappearance of login fields.
    const loginStateReached = await Promise.race([
      page
        .waitForFunction(
          () => !location.href.includes("/nlogin/login"),
          { timeout: 60000 }
        )
        .then(() => true)
        .catch(() => false),
      page
        .waitForSelector("#usernameField", { hidden: true, timeout: 60000 })
        .then(() => true)
        .catch(() => false)
    ]);

    if (!loginStateReached) {
      const currentUrl = page.url();
      await page.screenshot({ path: "login-stuck.png", fullPage: true });
      throw new Error(
        `Login did not complete in time. Current URL: ${currentUrl}. Check login-stuck.png for captcha/challenge.`
      );
    }

    // 📄 PROFILE PAGE
    console.log("📄 Navigating to profile...");
    await page.goto("https://www.naukri.com/mnjuser/profile", {
      waitUntil: "networkidle2"
    });

    // ✏️ EDIT HEADLINE
    console.log("✏️ Opening headline editor...");
    await page.waitForSelector("#lazyResumeHead .edit", {
      timeout: 20000,
      visible: true
    });
    await page.click("#lazyResumeHead .edit");

    await page.waitForSelector("#resumeHeadline", {
      timeout: 20000,
      visible: true
    });

    const resumeHeadline = await page.$("#resumeHeadline");

    if (resumeHeadline) {
      console.log("📝 Updating resume headline...");

      // Select all text + clear
      await resumeHeadline.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");

      const currentValue = await page.evaluate(
        el => el.value,
        resumeHeadline
      );

      // Toggle text to trigger "profile updated"
      if (currentValue.includes("SQL.")) {
        await resumeHeadline.type(resumeHeadlineText2, { delay: 30 });
      } else {
        await resumeHeadline.type(resumeHeadlineText, { delay: 30 });
      }
    } else {
      console.log("⚠️ Resume headline not found, skipping...");
    }

    // 💾 SAVE
    console.log("💾 Saving profile...");
    const saveSelector = "form[name='resumeHeadlineForm'] button[type='submit']";
    await page.waitForSelector(saveSelector, {
      timeout: 20000,
      visible: true
    });
    await page.$eval(saveSelector, el => {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    });

    const saveButton = await page.$(saveSelector);
    if (!saveButton) {
      throw new Error("Save button not found in resume headline modal");
    }

    try {
      await saveButton.click();
    } catch {
      await page.evaluate(selector => {
        const el = document.querySelector(selector);
        if (!el) {
          throw new Error("Save button missing during fallback click");
        }
        el.click();
      }, saveSelector);
    }

    // wait for save to complete
    await new Promise(r => setTimeout(r, 3000));

    // 📸 Debug screenshot (VERY useful for GitHub)
    await page.screenshot({ path: "result.png" });

    console.log("✅ Profile updated successfully!");
  } catch (err) {
    console.error("❌ Error occurred:", err.message);

    // take screenshot on failure
    try {
      await page.screenshot({ path: "error.png" });
    } catch {}

    process.exit(1);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed");
  }
})();
