// 동의와 공급자 설정이 모두 있을 때만 개인정보를 제거해 공통 분석 이벤트를 전송한다.
"use client";

const CONSENT_KEY = "robom:analytics-consent:v1";
const ANONYMOUS_KEY = "robom:anonymous-id:v1";
const FORBIDDEN = /latitude|longitude|address|email|phone|token|endpoint|medication|medicine|hospital|calendar|raw_query|raw_answer|search|note/i;
const ENDPOINT = process.env.NEXT_PUBLIC_FAMILY_ANALYTICS_ENDPOINT ?? "";

export type FamilyEvent = {
  event_name: string;
  app_id?: string;
  surface: string;
  campaign?: string;
  properties?: Record<string, string | number | boolean>;
};

function platform() {
  const userAgent = navigator.userAgent;
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "web";
}

function anonymousId() {
  let value = localStorage.getItem(ANONYMOUS_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_KEY, value);
  }
  return value;
}

function scrub(properties: FamilyEvent["properties"] = {}) {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => !FORBIDDEN.test(key) && ["string", "number", "boolean"].includes(typeof value)));
}

export const familyAnalytics = {
  consented() {
    return typeof window !== "undefined" && localStorage.getItem(CONSENT_KEY) === "granted";
  },
  setConsent(granted: boolean) {
    localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  },
  track(event: FamilyEvent) {
    if (!ENDPOINT || !this.consented()) return;
    let endpoint: URL;
    try { endpoint = new URL(ENDPOINT, location.origin); } catch { return; }
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") return;
    const payload = {
      event_name: event.event_name,
      app_id: event.app_id ?? "robom",
      app_version: "2.1.2",
      platform: platform(),
      surface: event.surface,
      session_kind: sessionStorage.getItem("robom:seen:v1") ? "returning-session" : "fresh-session",
      anonymous_id: anonymousId(),
      timestamp: new Date().toISOString(),
      campaign: event.campaign ?? "direct",
      family_spec_version: "1.0.0",
      properties: scrub(event.properties),
    };
    sessionStorage.setItem("robom:seen:v1", "1");
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  },
};
