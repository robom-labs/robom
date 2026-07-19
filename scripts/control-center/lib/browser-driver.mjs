// 브라우저 심층 점검 드라이버 — 데스크톱에서는 Electron(숨김 창·sandbox), 개발·CI에서는 Playwright.
// 계약: run({url, viewport, timeoutMs, seedStorage, collectStorageKeys}) →
//   { consoleErrors: string[], scrollWidth, innerWidth, title, bodyTextLength, storage: {key: value} }
// 원칙(§6.1): 원격 페이지 script는 로컬 filesystem·IPC·token에 접근 불가(sandbox·in-memory partition),
//   storage 내용은 판정에만 쓰고 증거로 원문 저장하지 않는다. 실제 사용자 프로필은 절대 읽지 않는다.
let driver = null;

export function setBrowserDriver(value) { driver = value; }
export function getBrowserDriver() { return driver; }

// 페이지에서 실행할 수집 스크립트(문자열 고정 — 임의 코드 주입 없음)
export function metricsScript(collectStorageKeys = []) {
  const keys = JSON.stringify(collectStorageKeys.slice(0, 8));
  return `(() => {
    const doc = document;
    let storage = {};
    try { for (const key of ${keys}) storage[key] = window.localStorage.getItem(key); } catch { storage = {}; }
    try { for (const key of Object.keys(window.localStorage || {})) { if (/recovery|backup|lkg/i.test(key)) storage[key] = window.localStorage.getItem(key); } } catch { /* 접근 차단 환경 */ }
    return {
      title: doc.title || "",
      scrollWidth: doc.documentElement ? doc.documentElement.scrollWidth : 0,
      innerWidth: window.innerWidth || 0,
      bodyTextLength: doc.body ? (doc.body.innerText || "").trim().length : 0,
      storage,
    };
  })()`;
}

export function seedScript(seedStorage = {}) {
  return `(() => { try { const seed = ${JSON.stringify(seedStorage)}; for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, value); return true; } catch { return false; } })()`;
}

// 개발·CI 환경용 Playwright 드라이버(모듈이 있을 때만 활성 — 패키지 앱에는 없음)
export async function tryActivatePlaywrightDriver(modulePath = "playwright") {
  try {
    const { chromium } = await import(modulePath);
    setBrowserDriver({
      name: "playwright",
      async run({ url, viewport, timeoutMs = 45_000, seedStorage, collectStorageKeys }) {
        const browser = await chromium.launch({ executablePath: process.env.ROBOM_HQ_CHROMIUM || undefined });
        try {
          const page = await browser.newPage({ viewport });
          const consoleErrors = [];
          page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
          page.on("pageerror", (e) => consoleErrors.push(String(e?.message || e).slice(0, 200)));
          await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
          if (seedStorage && Object.keys(seedStorage).length) {
            await page.evaluate(seedScript(seedStorage));
            await page.reload({ waitUntil: "load", timeout: timeoutMs });
          }
          await page.waitForTimeout(1500);
          const metrics = await page.evaluate(metricsScript(collectStorageKeys || []));
          return { consoleErrors, ...metrics };
        } finally { await browser.close(); }
      },
    });
    return true;
  } catch { return false; }
}
