// electron-builder afterPack 훅 — macOS 앱을 ad-hoc 서명한다.
// Apple Developer 인증서가 없어도 Apple Silicon(arm64)에서 "손상됨"이 아니라
// 정상적인 "확인되지 않은 개발자"(우클릭→열기로 실행 가능) 상태가 되게 한다.
"use strict";
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = context.packager.appInfo.productFilename; // "ROBOM HQ"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  try {
    // 나중에 실제 인증서가 생기면 이 훅 없이 electron-builder가 정식 서명한다.
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath], { stdio: "inherit" });
    console.log(`[after-pack] ad-hoc 서명 완료: ${appPath}`);
  } catch (error) {
    console.error(`[after-pack] ad-hoc 서명 실패(계속 진행): ${error.message}`);
  }
};
