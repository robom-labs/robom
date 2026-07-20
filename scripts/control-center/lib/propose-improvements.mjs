// 로봄 HQ 자동 점검 — 실제 스냅샷 신호(건강·데이터 신선도·다음 행동)만으로 개선 제안을 만든다.
// 연출 금지: 근거 없는 제안은 만들지 않는다. 이미 올라온 제안과 중복도 피한다.
// 반환: [{ appId, title, body, recommendation, priority, key }] (최대 limit개)

const KEY = (appId, kind) => `${appId}:${kind}`;

export function generateProposals(snapshot, existingApprovals = [], { limit = 5 } = {}) {
  if (!snapshot || !Array.isArray(snapshot.apps)) return [];
  const seen = new Set(existingApprovals.map((a) => a.proposalKey).filter(Boolean));
  const out = [];
  const push = (p) => { if (!seen.has(p.key) && !out.some((o) => o.key === p.key)) out.push(p); };
  const family = snapshot.apps.filter((a) => a.id !== "robom");

  // 1) 운영 장애·경고 → 최우선 확인 제안
  for (const app of family) {
    if (app.health === "down") {
      push({ appId: app.id, key: KEY(app.id, "down"), priority: "urgent",
        title: `${app.name} 운영 장애 확인`, body: app.blocked || app.production?.warnings?.[0] || "운영 표면에서 장애 신호가 감지되었습니다.",
        recommendation: "원인을 진단하고, 마지막 정상 배포로의 복구 또는 수정 배포를 준비합니다." });
    } else if (app.health === "warn" || (app.production?.warnings || []).length) {
      push({ appId: app.id, key: KEY(app.id, "warn"), priority: "high",
        title: `${app.name} 데이터·상태 점검`, body: app.production?.warnings?.[0] || "권장 확인 시점을 넘겼습니다. 현재는 마지막 정상 데이터를 사용 중입니다.",
        recommendation: "공식 데이터 소스를 다시 수집하고 최신성을 검증합니다." });
    }
  }
  // 2) 다음 개선 행동(nextActions) → 성장 제안
  for (const app of family) {
    const next = (app.nextActions || [])[0];
    if (next) push({ appId: app.id, key: KEY(app.id, "next"), priority: "normal",
      title: `${app.name} 개선: ${next.length > 40 ? next.slice(0, 40) + "…" : next}`, body: next,
      recommendation: "핵심 행동까지의 단계를 줄이거나 오류를 낮추는 방향으로 작은 단위로 구현합니다." });
  }
  // 3) CI 실패 → 배포 안전 점검(장애로 이미 잡히지 않은 경우만)
  for (const app of family) {
    if (app.health === "down") continue; // 장애 제안과 중복 방지
    const failedCi = (app.ci || []).find((r) => r.conclusion === "failure");
    if (failedCi) push({ appId: app.id, key: KEY(app.id, "ci"), priority: "high",
      title: `${app.name} CI 실패 확인`, body: `${failedCi.name || "워크플로"} 실행이 실패로 끝났습니다.`,
      recommendation: "실패 로그를 확인하고, 배포 전에 원인을 수정하거나 재실행합니다." });
  }
  // 4) 열린 PR이 오래 남아 있으면 정리 제안
  for (const app of family) {
    if ((app.openPrs || []).length) push({ appId: app.id, key: KEY(app.id, "pr"), priority: "normal",
      title: `${app.name} 열린 PR ${app.openPrs.length}건 검토`, body: "머지 대기 중인 변경이 남아 있습니다.",
      recommendation: "리뷰를 마치고 머지하거나, 필요 없으면 닫아 작업 흐름을 정리합니다." });
  }
  // 5) 회사 차원 보안 점검 실패 → 보안 확인 제안(실측 점검 결과가 있을 때만)
  const failedSecurity = (snapshot.operations?.security || []).filter((c) => c && c.ok === false);
  if (failedSecurity.length) push({ appId: "", key: KEY("company", "security"), priority: "high",
    title: `보안 점검 ${failedSecurity.length}건 확인 필요`, body: failedSecurity.map((c) => c.name).filter(Boolean).join(", ") || "보안 점검 항목이 통과하지 못했습니다.",
    recommendation: "비밀값 노출·권한·외부 링크 등 실패 항목을 확인하고 조치합니다." });

  // 6) 성장 백로그가 마르지 않게: 급한 장애·구체 개선 신호가 없는(건강한) 앱에도 '다음 성장' 한 걸음을 세워둔다.
  //    가짜 문제를 지어내지 않는다 — 문제가 없음을 정직히 밝히고, Codex 실행기가 실제 코드베이스를 보고
  //    다음 개선(작은 신기능·UX·성능)을 발굴·구현하는 '성장 지시'다. 유지보수에만 머물지 않기 위함(회장 요구 8).
  for (const app of family) {
    if (out.some((o) => o.appId === app.id)) continue; // 이 앱에 이번에 만든 제안이 있으면 생략
    if ([...seen].some((k) => k.startsWith(`${app.id}:`))) continue; // 이 앱에 이미 대기 중 제안이 있으면 생략(중복 방지)
    push({ appId: app.id, key: KEY(app.id, "grow"), priority: "low",
      title: `${app.name} 다음 개선·신기능 발굴`,
      body: `${app.name}에 급한 장애나 대기 중 개선이 없습니다 — 유지보수에 머물지 않도록 다음 성장 한 걸음을 만듭니다.`,
      recommendation: "Codex 실행기가 코드·사용자 흐름을 살펴 다음 개선(작은 신기능·UX·성능·접근성)을 하나 발굴해 작은 단위로 구현·검증합니다." });
  }

  // 장애 > 경고·CI > 다음개선 > PR > 성장 순으로 정렬해 상위 limit개
  const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
  out.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  return out.slice(0, limit);
}
