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
    // 서명 실패를 삼키고 계속 진행하면 dmg/zip은 그대로 만들어지고 릴리스 워크플로의 "산출물 확인"
    // 스텝도 파일 존재만 보므로 CI는 초록불로 끝난다. 이 훅의 유일한 목적이 "손상됨" 대신 "확인되지
    // 않은 개발자"로 뜨게 하는 것인데, 서명이 실제로 안 됐으면 정확히 그 목적이 조용히 무너진
    // 채(회장이 겪을 UX 저하를 아무도 모른 채) 릴리스된다 → 빌드를 실패시켜 CI에서 보이게 한다.
    throw new Error(`[after-pack] ad-hoc 서명 실패 — 이대로 배포하면 macOS에서 '손상됨'이 뜰 수 있습니다: ${error.message}`);
  }
};
