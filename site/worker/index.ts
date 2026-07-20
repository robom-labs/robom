/** 로봄 통합 홈페이지의 Cloudflare Worker 진입점. */
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// 사이트 전역에 보안 헤더가 하나도 없어(worker는 단순 passthrough), 회장이 앱을 받는 핵심 경로인
// /get/[id]가 clickjacking(투명 iframe으로 설치 버튼 위 덮기)에 노출돼 있었다. script-src/style-src
// 같은 앱 내부 렌더링에 영향을 줄 수 있는 CSP 세부 지시문은 이 샌드박스에서 실제 배포 검증이 불가능해
// 손대지 않고, 프레이밍만 막는 안전한 헤더(어떤 페이지 렌더링도 깨지지 않음)만 추가한다.
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response);
  },
};

export default worker;
