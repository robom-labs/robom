// ROBOM HQ macOS/Windows 데스크톱 셸.
// 내장 payload(본부 서버+화면)를 그대로 실행하고, 데이터(runtime·snapshots)는
// OS 표준 사용자 데이터 폴더에 저장한다(앱 번들은 읽기 전용이어도 동작).
// 창을 닫아도 트레이에서 계속 감시하며, 트레이에서 일시정지·재개·완전 종료할 수 있다.
"use strict";
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, Notification } = require("electron");
const { chmodSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
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

// 종료해도 되살리는 KeepAlive LaunchAgent(kr.robom.company-os)는 "꺼도 자꾸 켜지는" 진짜 원인이다.
// v2.7.0: 1회가 아니라 앱을 켤 때마다 무조건 제거한다(구버전에서 이미 깔린 것도 확실히 정리).
function killLegacyAutostart() {
  if (process.platform !== "darwin") return;
  try {
    const label = "kr.robom.company-os";
    const plistPath = join(app.getPath("home"), "Library", "LaunchAgents", `${label}.plist`);
    spawnSync("launchctl", ["bootout", `gui/${process.getuid()}/${label}`], { encoding: "utf8" });
    spawnSync("launchctl", ["disable", `gui/${process.getuid()}/${label}`], { encoding: "utf8" });
    if (existsSync(plistPath)) rmSync(plistPath, { force: true });
  } catch (error) { console.error("[robom-hq] 레거시 자동시작 LaunchAgent 제거 실패", error); }
}

// 자동 시작(부팅 시 로그인 항목)은 기본 OFF. 회장이 트레이에서 직접 켠 경우에만(마커) 존중한다.
// 마커가 없으면 매 실행마다 로그인 항목을 꺼서 "몰래 다시 켜짐"을 원천 차단한다.
function normalizeAutoStart(dataRoot) {
  try {
    killLegacyAutostart(); // 매 실행마다 되살림 엔진 제거
    if (process.platform !== "darwin" && process.platform !== "win32") return;
    const optedIn = existsSync(join(dataRoot, "autostart-user-enabled"));
    if (!optedIn && app.getLoginItemSettings().openAtLogin) {
      app.setLoginItemSettings({ openAtLogin: false, openAsHidden: false });
    }
  } catch (error) {
    console.error("[robom-hq] 자동 시작 정규화 실패", error);
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
      if (quitting) throw new Error("앱 종료 중 — 점검 창을 열지 않습니다"); // 종료 중엔 숨은 점검 창을 새로 만들지 않는다(종료 지연 방지)
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
      let httpStatus = 0; // 메인 프레임 HTTP 응답 코드 — 404/500 오류 페이지를 '정상'으로 통과시키지 않기 위해 포착
      win.webContents.on("did-navigate", (_e, _url, code) => { if (Number.isInteger(code) && code > 0) httpStatus = code; });
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
        return { consoleErrors, httpStatus, ...metrics };
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
  if (!serverLink) return { ok: false, reason: "본부 서버가 아직 실행되지 않았습니다." };
  try {
    const res = await fetch(new URL(path, serverLink), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, reason: `서버 응답 ${res.status}` };
    return { ok: true };
  } catch (error) {
    console.error("[robom-hq] 제어 API 실패", error);
    return { ok: false, reason: String(error?.message || error) };
  }
}

// 긴급 일시정지/재시작은 안전 브레이크다. 조용히 실패하면 회장은 멈춘 줄 알지만 실제로는 계속 돈다(거짓 안전).
// 성공/실패를 반드시 알린다.
async function controlWithFeedback(paused) {
  const r = await apiPost("/api/control", { paused });
  if (r.ok) {
    if (Notification.isSupported()) new Notification({ title: "로봄 본부", body: paused ? "모든 자동작업을 일시정지했습니다." : "자동작업을 다시 시작했습니다." }).show();
  } else {
    dialog.showMessageBox({ type: "error", title: "명령이 적용되지 않았습니다",
      message: paused ? "‘모든 자동작업 일시정지’가 적용되지 않았습니다." : "‘자동작업 다시 시작’이 적용되지 않았습니다.",
      detail: `${r.reason}\n\n본부 창을 열어 상태를 확인하고 다시 시도해 주세요.` });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 560,
    title: windowTitle(),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }, // 스모크 창과 동일하게 렌더러 샌드박스(심층 방어)
  });
  mainWindow.loadURL(serverLink);
  // 화면 자체가 곧 document.title을 버전 포함 문구로 갱신하지만(app.js loadVersion),
  // 로딩 중 잠깐 보이는 제목도 실제 버전으로 정확히 표시한다.
  mainWindow.setTitle(windowTitle());
  // v2.7.0: 창을 닫으면 앱을 완전히 종료한다("끄면 그냥 꺼진다"). 트레이로 숨겨 계속 도는 동작 폐지.
  mainWindow.on("close", () => { quitting = true; app.quit(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // 본부 화면 내부 이동만 허용 — 반드시 origin(호스트+포트)으로 비교한다.
    // 문자열 startsWith 비교는 http://127.0.0.1:PORT@attacker.com 같은 userinfo 우회를 허용하므로 금지.
    try { if (serverLink && new URL(url).origin === new URL(serverLink).origin) return; } catch { /* 잘못된 URL은 아래에서 차단 */ }
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
    { label: "모든 자동작업 일시정지", click: () => controlWithFeedback(true) },
    { label: "자동작업 다시 시작", click: () => controlWithFeedback(false) },
    { type: "separator" },
    {
      label: "부팅 시 자동 시작 (기본 꺼짐)",
      type: "checkbox",
      checked: process.platform === "darwin" || process.platform === "win32" ? app.getLoginItemSettings().openAtLogin : false,
      click: (item) => {
        // 회장이 명시적으로 켠 경우에만 마커를 남겨, 다음 실행에서 자동으로 끄지 않는다.
        try {
          const marker = join(app.getPath("userData"), "autostart-user-enabled");
          if (item.checked) writeFileSync(marker, new Date().toISOString());
          else if (existsSync(marker)) rmSync(marker, { force: true });
        } catch { /* 마커 실패 무시 */ }
        app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: false });
        if (RUNTIME_DIR) writeDesktopStatus(RUNTIME_DIR);
      },
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
  // 시작 이후의 예기치 못한 오류가 프로세스를 조용히 죽이지 않게 한다(자동 재실행은 하지 않음 — "끄면 꺼진다" 원칙 유지).
  process.on("unhandledRejection", (reason) => { try { console.error("[robom-hq] unhandledRejection", reason); } catch { /* noop */ } });
  process.on("uncaughtException", (error) => {
    try { console.error("[robom-hq] uncaughtException", error); } catch { /* noop */ }
    if (quitting) return; // 종료 중 오류는 무시
    try { dialog.showErrorBox("ROBOM HQ 오류", String(error?.stack || error).slice(0, 2000)); } catch { /* 대화상자 실패 무시 */ }
  });
  app.whenReady().then(async () => {
    app.setName("ROBOM HQ");
    const { dataRoot, runtimeDir } = prepareDataDirs();
    RUNTIME_DIR = runtimeDir;
    normalizeAutoStart(dataRoot);
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
  app.on("before-quit", () => { quitting = true; try { tray?.destroy(); } catch { /* 이미 없음 */ } }); // 트레이 아이콘 잔상 제거("끄면 꺼질 것")
  // v2.7.0: "끄면 그냥 꺼진다" — 창을 닫으면(모든 창이 닫히면) 앱을 완전히 종료한다.
  // 예전의 '트레이 상주(닫아도 계속 실행)'가 회장이 껐는데도 켜져 있는 것처럼 느껴지게 했다.
  app.on("window-all-closed", () => { quitting = true; app.quit(); });
}
