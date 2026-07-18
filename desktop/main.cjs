// ROBOM HQ macOS/Windows 데스크톱 셸.
// 내장 payload(본부 서버+화면)를 그대로 실행하고, 데이터(runtime·snapshots)는
// OS 표준 사용자 데이터 폴더에 저장한다(앱 번들은 읽기 전용이어도 동작).
// 창을 닫아도 트레이에서 계속 감시하며, 트레이에서 일시정지·재개·완전 종료할 수 있다.
"use strict";
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } = require("electron");
const { existsSync, mkdirSync, copyFileSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let tray = null;
let serverLink = null;
let quitting = false;

const payloadDir = app.isPackaged
  ? join(process.resourcesPath, "payload")
  : join(__dirname, "payload");

function prepareDataDirs() {
  const dataRoot = app.getPath("userData");
  const runtimeDir = join(dataRoot, "runtime");
  const snapDir = join(dataRoot, "snapshots");
  mkdirSync(runtimeDir, { recursive: true });
  mkdirSync(snapDir, { recursive: true });
  // 첫 실행: 스냅샷이 아직 없으면 payload의 예시 스냅샷으로 화면을 먼저 연다(정직한 미리보기 표시).
  const example = join(payloadDir, "ops/control-center/snapshots/example.json");
  const target = join(snapDir, "example.json");
  if (existsSync(example) && !existsSync(target)) copyFileSync(example, target);
  process.env.ROBOM_HQ_RUNTIME_DIR = runtimeDir;
  process.env.ROBOM_HQ_SNAP_DIR = snapDir;
  return { runtimeDir, snapDir };
}

async function startServer() {
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
    width: 1320,
    height: 880,
    minWidth: 360,
    minHeight: 600,
    title: "ROBOM HQ",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(serverLink);
  mainWindow.on("close", (event) => {
    if (!quitting) { // 창만 닫고 감시는 트레이에서 계속
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === "darwin") app.dock?.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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
  tray.setToolTip("ROBOM HQ — 로봄 자율 운영 본사");
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
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
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
    prepareDataDirs();
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
