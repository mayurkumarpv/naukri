const puppeteer = require("puppeteer");
const fs = require("node:fs");

const resumeHeadlineText =
  "Result driven professional having deep expertise in Frontend Development, Software Development Life Cycle, User Experience Design, Data Visualization, Agile Methodology, Code Quality Assurance, JavaScript, TypeScript, Material UI, Node.js, SQL.";

const resumeHeadlineText2 =
  "Result driven professional having deep expertise in Frontend Development, Software Development Life Cycle, User Experience Design, Data Visualization, Agile Methodology, Code Quality Assurance, JavaScript, TypeScript, Material UI, Node.js, SQL";

const profileUrl = "https://www.naukri.com/mnjuser/profile";
const userDataDir = process.env.PUPPETEER_USER_DATA_DIR || ".puppeteer-profile";
const headlessMode = process.env.PUPPETEER_HEADLESS || "new";

const isOnLoginPage = url => url.includes("/nlogin/login");

const tryLoginWithCookies = async page => {
  if (!process.env.NAUKRI_COOKIES_JSON) {
    return false;
  }

  let cookies;
  try {
    cookies = JSON.parse(process.env.NAUKRI_COOKIES_JSON);
  } catch {
    throw new Error("NAUKRI_COOKIES_JSON is not valid JSON");
  }

  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error("NAUKRI_COOKIES_JSON must be a non-empty cookie array");
  }

  await page.setCookie(...cookies);
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
  await new Promise(r => setTimeout(r, 3000));

  return !isOnLoginPage(page.url());
};

(async () => {
  console.log("🚀 Starting script...");

  if (!process.env.NAUKRI_EMAIL || !process.env.NAUKRI_PASSWORD) {
    throw new Error(
      "Missing NAUKRI_EMAIL or NAUKRI_PASSWORD environment variables"
    );
  }

  const browser = await puppeteer.launch({
    headless: headlessMode === "false" ? false : headlessMode,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1366,768"
    ]
  });

  console.log(`🗂️ Using Chrome profile: ${userDataDir}`);
  console.log(`🧭 Headless mode: ${headlessMode}`);

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
    let loggedIn = false;

    // First preference for CI: use an existing authenticated cookie jar.
    loggedIn = await tryLoginWithCookies(page);

    if (loggedIn) {
      console.log("✅ Logged in using NAUKRI_COOKIES_JSON session");
    }

    // 🔐 LOGIN
    if (!loggedIn) {
      if (process.env.CI) {
        throw new Error(
          "Cookie-based login failed or no NAUKRI_COOKIES_JSON provided. " +
          "Credential login is blocked by OTP in CI. " +
          "Please update NAUKRI_COOKIES_JSON in GitHub Secrets."
        );
      }

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

      const loginErrorText = await page.evaluate(() => {
        const selectors = [
          ".err",
          ".error",
          ".server-err",
          "#usernameField + .err",
          "#passwordField + .err"
        ];

        for (const selector of selectors) {
          const el = document.querySelector(selector);
          const text = (el?.textContent || "").trim();
          if (text) {
            return text;
          }
        }

        return "";
      });

      if (loginErrorText) {
        await page.screenshot({ path: "login-invalid-credentials.png", fullPage: true });
        throw new Error(
          `Login failed with server message: ${loginErrorText}. Check login-invalid-credentials.png.`
        );
      }
    }

    // 📄 PROFILE PAGE
    console.log("📄 Navigating to profile...");
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded"
    });

    // Give dynamic widgets time to hydrate in CI/headless.
    await new Promise(r => setTimeout(r, 4000));

    if (page.url().includes("/nlogin/login")) {
      await page.screenshot({ path: "profile-redirected-to-login.png", fullPage: true });
      fs.writeFileSync("profile-redirected-to-login.html", await page.content(), "utf8");

      const bodyText = await page.evaluate(() => (document.body?.innerText || "").toLowerCase());
      const hasRecaptcha = await page.$(".g-recaptcha") !== null;
      const challengeDetected =
        hasRecaptcha ||
        bodyText.includes("captcha") ||
        bodyText.includes("verify") ||
        bodyText.includes("unusual") ||
        bodyText.includes("challenge");

      throw new Error(
        challengeDetected
          ? "Profile redirected to login due possible captcha/challenge in CI. Check profile-redirected-to-login.png and profile-redirected-to-login.html. Consider using NAUKRI_COOKIES_JSON in GitHub Secrets."
          : "Profile redirected to login in CI. Possible causes: wrong credentials, expired session, or risk check. Check profile-redirected-to-login.png and profile-redirected-to-login.html."
      );
    }

    const clickResumeHeadlineEdit = async () => {
      const directHandle = await page.$("#lazyResumeHead .edit");
      if (directHandle) {
        await directHandle.evaluate(el => {
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        });
        await directHandle.click();
        return true;
      }

      const clickedFromTitle = await page.evaluate(() => {
        const titles = Array.from(document.querySelectorAll(".widgetTitle"));
        const title = titles.find(el =>
          (el.textContent || "").trim().toLowerCase() === "resume headline"
        );
        if (!title) {
          return false;
        }

        const widgetHead = title.closest(".widgetHead");
        const editBtn = widgetHead?.querySelector(".edit");
        if (!editBtn) {
          return false;
        }

        editBtn.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        editBtn.click();
        return true;
      });

      return clickedFromTitle;
    };

    // ✏️ EDIT HEADLINE
    console.log("✏️ Opening headline editor...");
    let editOpened = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      editOpened = await clickResumeHeadlineEdit();
      if (editOpened) {
        break;
      }

      await page.evaluate(y => window.scrollBy(0, y), 300);
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!editOpened) {
      await page.screenshot({ path: "resume-edit-not-found.png", fullPage: true });
      fs.writeFileSync("resume-edit-not-found.html", await page.content(), "utf8");
      throw new Error(
        "Resume headline edit control not found. Check resume-edit-not-found.png and resume-edit-not-found.html"
      );
    }

    await page.waitForSelector("#resumeHeadline", {
      timeout: 30000,
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
