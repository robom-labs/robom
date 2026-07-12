// 로봄 패밀리가 사용하는 오픈소스와 저장소별 라이선스 확인 경로를 안내한다.
import { PageShell } from "../components";
import { familyApps } from "../app-data";

const REPOSITORIES = {
  outbom: "https://github.com/robom-labs/outbom",
  homebom: "https://github.com/robom-labs/homebom",
  runningbom: "https://github.com/robom-labs/runningbom",
} as const;

export default function LicensesPage() {
  return (
    <PageShell>
      <article className="legal-page">
        <p className="eyebrow"><span aria-hidden="true" /> OPEN SOURCE</p>
        <h1>오픈소스 라이선스</h1>
        <p className="info-lead">각 서비스의 실제 소스와 의존성 라이선스는 해당 GitHub 저장소에서 확인할 수 있습니다.</p>
        {familyApps.map((app) => (
          <section key={app.id}>
            <h2>{app.name}</h2>
            <p>{app.description}</p>
            <p><a href={REPOSITORIES[app.id]}>GitHub 저장소에서 라이선스 확인하기</a></p>
          </section>
        ))}
      </article>
    </PageShell>
  );
}
