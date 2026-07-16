// 생성된 registry 메타데이터와 앱별 고유 문구를 결합해 홈페이지 단일 앱 모델을 제공한다.
import { appCopy } from "./app-copy";
import { generatedAppMeta } from "./generated-app-data";

export type AppId = (typeof generatedAppMeta)[number]["id"];
export type StoreStatus = "planned" | "internal" | "live" | "testflight";

export type FamilyApp = {
  id: AppId;
  name: string;
  englishName: string;
  prefix: string;
  tagline: string;
  description: string;
  metadataTitle: string;
  metadataDescription: string;
  mobileValue: string;
  mobileAction: string;
  status: "live";
  statusLabel: string;
  accessLabel: string;
  version: string;
  webUrl: string;
  stableInstallUrl: string;
  pwaInstallUrl: string;
  googlePlayUrl: string;
  googlePlayStatus: StoreStatus;
  appStoreUrl: string;
  appStoreStatus: StoreStatus;
  mobileStatus: string;
  familySpecVersion: string;
  deployProvider: string;
  lastVerifiedAt: string;
  hubPath: `/apps/${AppId}`;
  installPath: `/get/${AppId}`;
  tone: "out" | "home" | "run" | "cal" | "cert";
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  metrics: readonly { value: string; label: string }[];
  highlights: readonly string[];
};

export const SITE_VERSION = "2.1.6";
export const SITE_BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";

export const familyApps: readonly FamilyApp[] = appCopy.map((copy) => {
  const meta = generatedAppMeta.find((item) => item.id === copy.id);
  if (!meta) throw new Error(`${copy.id}: generated registry metadata missing`);
  return {
    ...copy,
    ...meta,
    status: "live",
    statusLabel: "운영 중",
    accessLabel: "설치 안내",
    hubPath: `/apps/${copy.id}`,
    installPath: `/get/${copy.id}`,
  } as FamilyApp;
});

export function getFamilyApp(id: string) {
  return familyApps.find((app) => app.id === id);
}

export function contactHref(context = "로봄 웹사이트") {
  const subject = `[${context}] 문의·의견 · v${SITE_VERSION}`;
  return `mailto:hello.robom@gmail.com?subject=${encodeURIComponent(subject)}`;
}
