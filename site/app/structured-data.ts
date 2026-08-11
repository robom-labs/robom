// registry 출시 상태에 맞춰 앱 목록과 설치 페이지의 검색 구조화 데이터를 제공한다.
import type { FamilyApp } from "./app-data";
import { familyApps } from "./app-data";

const SITE_ORIGIN = "https://robom.kr";

function softwareApplication(app: FamilyApp) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_ORIGIN}${app.installPath}#app`,
    name: app.name,
    alternateName: app.englishName,
    description: app.metadataDescription,
    url: `${SITE_ORIGIN}${app.installPath}`,
    installUrl: app.googlePlayUrl,
    operatingSystem: "Android",
    applicationCategory: "LifestyleApplication",
    applicationVersion: app.version,
    inLanguage: "ko-KR",
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

export function appsItemList() {
  const liveApplications = familyApps.filter((app) => app.status === "live").map(softwareApplication);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList", "@id": `${SITE_ORIGIN}/#apps`, name: "로봄 패밀리 앱",
        numberOfItems: familyApps.length,
        itemListElement: familyApps.map((app, index) => ({
          "@type": "ListItem", position: index + 1, name: app.name, url: `${SITE_ORIGIN}${app.installPath}`,
          item: app.status === "live"
            ? { "@id": `${SITE_ORIGIN}${app.installPath}#app` }
            : { "@type": "WebPage", "@id": `${SITE_ORIGIN}${app.installPath}`, name: `${app.name} 출시 안내` },
        })),
      },
      ...liveApplications,
    ],
  };
}

export function installLandingStructuredData(app: FamilyApp) {
  const breadcrumb = {
    "@type": "BreadcrumbList", "@id": `${SITE_ORIGIN}${app.installPath}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "로봄", item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: `${app.name} 설치`, item: `${SITE_ORIGIN}${app.installPath}` },
    ],
  };
  return { "@context": "https://schema.org", "@graph": app.status === "live" ? [breadcrumb, softwareApplication(app)] : [breadcrumb] };
}
