// ROBOM HQ macOS/Windows 데스크톱 셸.
// 내장 payload(본부 서버+화면)를 그대로 실행하고, 데이터(runtime·snapshots)는
// OS 표준 사용자 데이터 폴더에 저장한다(앱 번들은 읽기 전용이어도 동작).
// 창을 닫아도 트레이에서 계속 감시하며, 트레이에서 일시정지·재개·완전 종료할 수 있다.
"use strict";
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } = require("electron");
const { chmodSync, existsSync, mkdirSync, copyFileSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let tray = null;
let serverLink = null;
let quitting = false;
let RUNTIME_DIR = null; // desktop-status.json 기록용(트레이 토글 시 즉시 갱신)

const payloadDir = app.isPackaged
  ? join(process.resourcesPath, "payload")
  : join(__dirname, "payload");

// 창 제목·트레이 툴팁에 항상 버전을 보여준다(다운로드한 버전을 한눈에 확인).
function readDownloadedVersion() {
  try {
    const v = JSON.parse(readFileSync(join(payloadDir, "ops/control-center/app/version.json"), "utf8"));
    return v.version || app.getVersion();
  } catch {
    return app.getVersion();
  }
}
const windowTitle = () => `ROBOM HQ v${readDownloadedVersion()}`;

// 외부 링크는 https + 허용된 호스트만 연다(임의 URL로 기본 브라우저를 여는 것을 차단).
const EXTERNAL_HOST_ALLOWLIST = new Set([
  "robom.kr",
  "www.robom.kr",
  "robom-labs.github.io",
  "github.com",
  "certbom.vercel.app",
]);
function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && EXTERNAL_HOST_ALLOWLIST.has(url.hostname);
  } catch {
    return false;
  }
}

function prepareDataDirs() {
  const dataRoot = app.getPath("userData");
  const runtimeDir = join(dataRoot, "runtime");
  const snapDir = join(dataRoot, "snapshots");
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  // 기존 설치에서 남은 느슨한 runtime 권한도 시작 시 즉시 복구한다.
  chmodSync(runtimeDir, 0o700);
  mkdirSync(snapDir, { recursive: true });
  // 예시 스냅샷은 payload 최신본으로 항상 새로 덮어쓴다(옛 버전의 5개 앱 예시가 남아 6개가 안 보이던 버그 방지).
  // example.json은 사용자 데이터가 아니라 첫 화면 fallback이므로 덮어써도 안전하다.
  const example = join(payloadDir, "ops/control-center/snapshots/example.json");
  const target = join(snapDir, "example.json");
  if (existsSync(example)) { try { copyFileSync(example, target); } catch (e) { /* 읽기 전용 등 예외 무시 */ } }
  process.env.ROBOM_HQ_RUNTIME_DIR = runtimeDir;
  process.env.ROBOM_HQ_SNAP_DIR = snapDir;
  // 완전 자동: 서버가 codex-runner를 직접 실행·감시하게 한다(회장이 터미널을 열지 않아도 됨).
  process.env.ROBOM_HQ_MANAGE_RUNNER = "1";
  return { runtimeDir, snapDir, dataRoot };
}

// 첫 실행 시 로그인 자동 시작을 기본 ON으로 한다(이후에는 회장의 선택을 존중).
function ensureLoginItemDefault(dataRoot) {
  try {
    const marker = join(dataRoot, "login-item-initialized");
    if (existsSync(marker)) return;
    if (process.platform === "darwin" || process.platform === "win32") {
      app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
    }
    require("node:fs").writeFileSync(marker, new Date().toISOString());
  } catch (error) {
    console.error("[robom-hq] 로그인 자동 시작 기본 설정 실패", error);
  }
}

// 맥/윈도 로그인 자동시작의 '실제' 등록 상태를 런타임에 노출한다(계약 c:robom-hq:login-item-status가 읽는다).
// 시스템 설정에서 회장이 껐는지 여부를 Electron 설정값이 아니라 OS 실제 상태로 판정하기 위함.
function writeDesktopStatus(runtimeDir) {
  try {
    let loginItem = null;
    if (process.platform === "darwin" || process.platform === "win32") {
      const s = app.getLoginItemSettings();
      loginItem = { openAtLogin: !!s.openAtLogin, openAsHidden: !!s.openAsHidden, wasOpenedAtLogin: !!s.wasOpenedAtLogin };
    }
    const payload = { platform: process.platform, appVersion: app.getVersion(), loginItem, at: new Date().toISOString() };
    require("node:fs").writeFileSync(join(runtimeDir, "desktop-status.json"), JSON.stringify(payload), { mode: 0o600 });
  } catch (error) {
    console.error("[robom-hq] desktop-status 기록 실패", error);
  }
}

// 심층 브라우저 점검 드라이버: 숨김 창(sandbox·메모리 세션)으로 운영 앱을 실제 렌더해 검사한다.
// 원격 페이지 script는 로컬 filesystem·IPC·token에 접근할 수 없다(§6.1). 사용자 프로필은 절대 쓰지 않는다.
async function registerElectronBrowserDriver() {
  const driverUrl = pathToFileURL(join(payloadDir, "scripts/control-center/lib/browser-driver.mjs")).href;
  const { setBrowserDriver, metricsScript, seedScript } = await import(driverUrl);
  let serial = 0;
  setBrowserDriver({
    name: "electron",
    async run({ url, viewport, timeoutMs = 45_000, seedStorage, collectStorageKeys }) {
      const win = new BrowserWindow({
        show: false,
        width: viewport?.width || 390,
        height: viewport?.height || 844,
        webPreferences: {
          sandbox: true, contextIsolation: true, nodeIntegration: false,
          partition: `smoke-${Date.now()}-${serial++}`, // 메모리 세션 — 실제 사용자 데이터와 격리
          images: true,
        },
      });
      const consoleErrors = [];
      win.webContents.on("console-message", (_e, level, message) => {
        if (level >= 3) consoleErrors.push(String(message).slice(0, 200));
      });
      win.webContents.on("will-navigate", (event, target) => {
        try { if (new URL(target).origin !== new URL(url).origin) event.preventDefault(); } catch { event.preventDefault(); }
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      try {
        const load = (target) => new Promise((resolveLoad, rejectLoad) => {
          const timer = setTimeout(() => rejectLoad(new Error("load timeout")), timeoutMs);
          win.webContents.once("did-finish-load", () => { clearTimeout(timer); resolveLoad(); });
          win.webContents.once("did-fail-load", (_e, code, desc) => { clearTimeout(timer); rejectLoad(new Error(`load fail ${code} ${desc}`)); });
          win.loadURL(target).catch(rejectLoad);
        });
        await load(url);
        if (seedStorage && Object.keys(seedStorage).length) {
          await win.webContents.executeJavaScript(seedScript(seedStorage), true);
          await load(url);
        }
        await new Promise((r) => setTimeout(r, 1500)); // 렌더 안정화
        const metrics = await win.webContents.executeJavaScript(metricsScript(collectStorageKeys || []), true);
        return { consoleErrors, ...metrics };
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    },
  });
}

async function startServer() {
  try { await registerElectronBrowserDriver(); } catch (error) {
    console.error("[robom-hq] 브라우저 점검 드라이버 등록 실패(HTTP 계약은 계속 동작)", error);
  }
  const serveUrl = pathToFileURL(join(payloadDir, "scripts/control-center/serve.mjs")).href;
  const { startControlCenter } = await import(serveUrl);
  const { link } = await startControlCenter({ port: 0, openBrowser: false, refreshSnapshot: true });
  return link;
}

async function apiPost(path, body) {
  if (!serverLink) return;
  try {
    await fetch(new URL(path, serverLink), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[robom-hq] 제어 API 실패", error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 560,
    title: windowTitle(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(serverLink);
  // 화면 자체가 곧 document.title을 버전 포함 문구로 갱신하지만(app.js loadVersion),
  // 로딩 중 잠깐 보이는 제목도 실제 버전으로 정확히 표시한다.
  mainWindow.setTitle(windowTitle());
  mainWindow.on("close", (event) => {
    if (!quitting) { // 창만 닫고 감시는 트레이에서 계속
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === "darwin") app.dock?.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (serverLink && url.startsWith(serverLink.replace(/\/+$/, ""))) return; // 본부 화면 내부 이동 허용
    event.preventDefault();
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
  });
}

function showWindow() {
  if (process.platform === "darwin") app.dock?.show();
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}

function buildTray() {
  const icon = nativeImage.createFromPath(join(payloadDir, "tray.png"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 18, height: 18 }));
  tray.setToolTip(`${windowTitle()} — 로봄 자율 운영 본사`);
  const menu = Menu.buildFromTemplate([
    { label: "본부 열기", click: showWindow },
    { type: "separator" },
    { label: "모든 자동작업 일시정지", click: () => apiPost("/api/control", { paused: true }) },
    { label: "자동작업 다시 시작", click: () => apiPost("/api/control", { paused: false }) },
    { type: "separator" },
    {
      label: "로그인 시 자동 시작",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked }); if (RUNTIME_DIR) writeDesktopStatus(RUNTIME_DIR); },
    },
    { type: "separator" },
    { label: "완전 종료", click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", showWindow);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.whenReady().then(async () => {
    app.setName("ROBOM HQ");
    const { dataRoot, runtimeDir } = prepareDataDirs();
    RUNTIME_DIR = runtimeDir;
    ensureLoginItemDefault(dataRoot);
    writeDesktopStatus(runtimeDir);
    try {
      serverLink = await startServer();
    } catch (error) {
      dialog.showErrorBox("ROBOM HQ 시작 실패", String(error?.stack || error));
      app.quit();
      return;
    }
    createWindow();
    buildTray();
    app.on("activate", showWindow);
  });
  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { /* 트레이 상주: 종료하지 않음 */ });
}
