const puppeteer = require("puppeteer");

const resumeHeadlineText =
  "Result driven professional having deep expertise in Frontend Development, Software Development Life Cycle, User Experience Design, Data Visualization, Agile Methodology, Code Quality Assurance, JavaScript, TypeScript, Material UI, Node.js, Python, SQL.";

const resumeHeadlineText2 =
  "Result driven professional having deep expertise in Frontend Development, Software Development Life Cycle, User Experience Design, Data Visualization, Agile Methodology, Code Quality Assurance, JavaScript, TypeScript, Material UI, Node.js, Python, SQL";

(async () => {
  console.log("🚀 Starting script...");

  const browser = await puppeteer.launch({
    headless: "new", // IMPORTANT for GitHub Actions
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    // 🔐 LOGIN
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

    // 📄 PROFILE PAGE
    console.log("📄 Navigating to profile...");
    await page.goto("https://www.naukri.com/mnjuser/profile", {
      waitUntil: "networkidle2"
    });

    // ✏️ EDIT HEADLINE
    console.log("✏️ Opening headline editor...");
    await page.waitForSelector("#lazyResumeHead", { timeout: 10000 });
    await page.click("#lazyResumeHead .edit");

    await page.waitForSelector("#resumeHeadline", { timeout: 10000 });

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
    await page.click("button[type='submit']");

    // wait for save to complete
    await page.waitForTimeout(3000);

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
