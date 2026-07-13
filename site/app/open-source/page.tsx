// 기존 앱의 오픈소스 링크를 정식 라이선스 페이지와 호환한다.
// 같은 내용의 중복 노출을 막기 위해 canonical은 /licenses를 가리킨다.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "오픈소스 라이선스", alternates: { canonical: "/licenses" } };

export { default } from "../licenses/page";
