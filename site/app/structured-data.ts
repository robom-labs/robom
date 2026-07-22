// 출시 준비 단계의 검색 구조화 데이터: SoftwareApplication 없이 조직·목록만 제공한다.
import type { FamilyApp } from "./app-data";
import { familyApps } from "./app-data";

const SITE_ORIGIN = "https://robom.kr";

// 4개 앱을 이름과 안정 설치 경로로 나열하는 ItemList(설치 가능한 소프트웨어로 표기하지 않는다).
export function appsItemList() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_ORIGIN}/#apps`,
    name: "로봄 패밀리 앱",
    numberOfItems: familyApps.length,
    itemListElement: familyApps.map((app, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: app.name,
      url: `${SITE_ORIGIN}${app.installPath}`,
    })),
  };
}

// 설치 안내 페이지: 출시 전이므로 SoftwareApplication/Offer/installUrl을 내지 않고 breadcrumb만 남긴다.
export function installLandingStructuredData(app: FamilyApp) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${SITE_ORIGIN}${app.installPath}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "로봄", item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: `${app.name} 설치`, item: `${SITE_ORIGIN}${app.installPath}` },
    ],
  };
}
