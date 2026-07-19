// 사건(incident)·결재(approval)를 "누가 어떻게 고치는가"로 결정론적으로 분류한다(AI 없음).
// 세 갈래:
//   self_heal — 컴퓨터가 계속 재점검하며, 실제 신호가 회복되면 자동으로 닫는다. 회장이 누를 것 없음.
//   codex     — 코드 변경이 필요하다. 회장이 "승인하고 맡기기"를 누르면 Codex 실행기가 고친다.
//   human     — 비밀키·권한·결제·법률·마이그레이션·삭제 등. 반드시 회장이 직접 처리한다.

// 회장 확인 필수 신호(전결 위임 금지와 동일 기준) — 비밀값·권한·결제·법률·계약·삭제·마이그레이션.
export const HUMAN_TEXT = /결제|구독료|유료|요금|청구|광고|홍보 게시|외부 게시|캠페인|개인정보|법률|약관|계약|스토어 제출|App Store|Play Store|출시|도메인|소유권|권한|비밀값|secret|시크릿|토큰|삭제(?!된)|마이그레이션|이전(?:합니다| 작업)/;

// 컴퓨터가 시간을 두고 스스로 재점검·회복 처리하는 계열(코드 변경 불필요).
export const SELF_HEAL_CLASSES = new Set([
  "availability", "production", "observability", "transport", "freshness", "data_stale", "notification",
]);
// 반드시 회장이 확인해야 하는 계열(코드로 못 고치는 계정·비밀·요금 문제).
export const HUMAN_CLASSES = new Set(["security", "quota"]);
// 나머지(schema·integrity·parity·storage·automation·ci …)는 코드 변경 = Codex.

export const FIX_LABEL = { self_heal: "컴퓨터 자동 처리", codex: "Codex로 수정", human: "회장 확인 필수" };

// 분류: 사람 상신·비밀/권한/결제 텍스트 → human, 보안/요금 계열 → human,
//       재점검·회복 계열 → self_heal, 그 외(코드 변경) → codex.
export function classifyFix({ failureClass = "", text = "", requestedBy = "auto-review" } = {}) {
  if (requestedBy && requestedBy !== "auto-review") return "human"; // 사람이 올린 안건은 항상 회장 판단
  if (HUMAN_TEXT.test(text) || HUMAN_CLASSES.has(failureClass)) return "human";
  if (SELF_HEAL_CLASSES.has(failureClass)) return "self_heal";
  return "codex";
}

// 회장에게 보여줄 한 줄 해결방안(숫자만 띄우지 않기 위함).
export function resolutionLine(fixClass, { recommendedAction = "", codexReady = true } = {}) {
  if (fixClass === "self_heal") {
    return recommendedAction
      ? `컴퓨터가 계속 재점검합니다. 신호가 회복되면 자동으로 닫힙니다. (${recommendedAction})`
      : "컴퓨터가 계속 재점검하며, 신호가 회복되면 자동으로 닫습니다. 회장님이 누를 것 없음.";
  }
  if (fixClass === "codex") {
    return codexReady
      ? "‘승인하고 맡기기’를 누르면 Codex 실행기가 코드로 고칩니다."
      : "코드 수정이 필요합니다. Codex 실행기(codex login)가 연결되면 승인 후 자동으로 고칩니다.";
  }
  return recommendedAction
    ? `회장님만 처리할 수 있는 항목입니다. ${recommendedAction}`
    : "비밀키·권한·결제 등 회장님 확인이 반드시 필요한 항목입니다.";
}

// 사건 배열을 세 갈래 보드로 묶는다(감지 시각·해결방안 포함).
export function classifyIncidents(incidents = [], { codexReady = true } = {}) {
  const board = { self_heal: [], codex: [], human: [] };
  for (const inc of incidents) {
    const text = `${inc.title || inc.userImpact || ""} ${inc.body || ""} ${inc.recommendedAction || inc.recommendation || ""}`;
    const fixClass = inc.fixClass || classifyFix({ failureClass: inc.failureClass, text, requestedBy: inc.requestedBy });
    board[fixClass].push({
      id: inc.id || inc.contractId,
      target: inc.target || inc.appId || "",
      title: inc.title || inc.userImpact || inc.contractId,
      detectedAt: inc.detectedAt || inc.firstFailedAt || inc.createdAt || null,
      severity: inc.severity || "warning",
      fixClass,
      resolution: resolutionLine(fixClass, { recommendedAction: inc.recommendedAction || inc.recommendation, codexReady }),
    });
  }
  return board;
}
