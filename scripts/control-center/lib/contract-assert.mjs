// 계약 판정용 assertion 연산 라이브러리 — v2.0.0 프롬프트 §4.2 operator allowlist.
// 원칙: eval·new Function·shell 금지. 연산자마다 입력 type을 검증하고 문자열 coercion으로 숫자를 비교하지 않는다.
// 판정은 오직 아래 등록된 연산으로만 한다(자연어·LLM 해석 금지).

// 경로 해석: "a.b.0.c" — 객체/배열만 타고 내려간다. 함수 호출·프로토타입 접근 금지.
export function resolvePath(value, path) {
  if (path === undefined || path === null || path === "") return value;
  const parts = String(path).split(".");
  let cur = value;
  for (const raw of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (raw === "__proto__" || raw === "constructor" || raw === "prototype") return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(raw);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx];
    } else if (typeof cur === "object") {
      cur = Object.hasOwn(cur, raw) ? cur[raw] : undefined;
    } else return undefined;
  }
  return cur;
}

// 위험한 정규식(중첩 수량자·중첩 대체) 거부 — catastrophic backtracking 방지.
export function safeRegex(pattern) {
  if (typeof pattern !== "string" || pattern.length > 300) return null;
  // 수량자를 품은 그룹/문자클래스에 다시 수량자가 붙으면 거부(중첩 수량자 = backtracking 폭발 위험)
  if (/\([^)]*[+*{][^)]*\)\s*[+*{]/.test(pattern) || /\[[^\]]*\]\s*[+*]\s*[+*]/.test(pattern)) return null;
  // 대체(|)를 품은 그룹에 수량자가 붙으면 거부. (a|a)+ 같은 겹치는 대체+반복은 중첩 수량자와 마찬가지로
  // 지수적 backtracking을 일으킨다(예: 31자 입력에 73초) — 위 검사는 그룹 '안'의 수량자만 잡아 이 형태를 놓쳤다.
  if (/\([^)]*\|[^)]*\)\s*[+*{]/.test(pattern)) return null;
  try { return new RegExp(pattern, "iu"); } catch { return null; }
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string";
const REGEX_MAX = 100_000; // 정규식 테스트 입력 상한 — alternation-overlap 등 backtracking 폭발로 판정이 멈추지 않게 한다

// 각 op: (actual, expected, assertion) → true(통과)/false(실패). type 불일치는 실패로 본다.
export const ASSERT_OPS = Object.freeze({
  eq: (a, e) => a === e && a !== undefined, // 둘 다 undefined(없는 필드끼리 '일치')를 거짓 PASS로 삼지 않는다
  neq: (a, e) => a !== e,
  gt: (a, e) => isNum(a) && isNum(e) && a > e,
  gte: (a, e) => isNum(a) && isNum(e) && a >= e,
  lt: (a, e) => isNum(a) && isNum(e) && a < e,
  lte: (a, e) => isNum(a) && isNum(e) && a <= e,
  finite: (a) => isNum(a),
  boolean: (a) => typeof a === "boolean",
  contains: (a, e) => (isStr(a) && isStr(e) && a.includes(e)) || (Array.isArray(a) && a.includes(e)),
  not_contains: (a, e) => (isStr(a) && isStr(e) && !a.includes(e)) || (Array.isArray(a) && !a.includes(e)),
  contains_any: (a, e) => isStr(a) && Array.isArray(e) && e.some((v) => isStr(v) && a.includes(v)),
  not_contains_any: (a, e) => isStr(a) && Array.isArray(e) && !e.some((v) => isStr(v) && a.includes(v)),
  matches_safe_regex: (a, e) => { const re = safeRegex(e); return Boolean(re && isStr(a) && re.test(a.slice(0, REGEX_MAX))); },
  not_matches_safe_regex: (a, e) => { const re = safeRegex(e); return Boolean(re && isStr(a) && !re.test(a.slice(0, REGEX_MAX))); },
  exists: (a) => a !== undefined && a !== null,
  not_exists: (a) => a === undefined || a === null,
  nonempty_string: (a) => isStr(a) && a.trim().length > 0,
  length_eq: (a, e) => (isStr(a) || Array.isArray(a)) && isNum(e) && a.length === e,
  length_gte: (a, e) => (isStr(a) || Array.isArray(a)) && isNum(e) && a.length >= e,
  length_lte: (a, e) => (isStr(a) || Array.isArray(a)) && isNum(e) && a.length <= e,
  is_array: (a) => Array.isArray(a),
  // 빈 배열은 진공참으로 통과시키지 않는다(every 쿼안티파이어와 같은 원칙 — 확인한 원소 0개인데 '중복 없음'은 거짓 PASS).
  unique: (a, e) => Array.isArray(a) && a.length > 0 && new Set(a.map((x) => (e ? resolvePath(x, e) : x))).size === a.length,
  subset: (a, e) => Array.isArray(a) && Array.isArray(e) && a.every((x) => e.includes(x)),
  same_set: (a, e) => { if (!Array.isArray(a) || !Array.isArray(e)) return false; const sa = new Set(a), se = new Set(e); return sa.size === se.size && [...sa].every((x) => se.has(x)); }, // 양방향·중복 무시 집합 동일성(중복이 length를 속이지 못함)
  one_of: (a, e) => Array.isArray(e) && e.includes(a),
  status_in: (a, e) => isNum(a) && Array.isArray(e) && e.includes(a),
  date_valid: (a) => isStr(a) && Number.isFinite(Date.parse(a)),
  date_order_lte: (a, e) => isStr(a) && isStr(e) && Number.isFinite(Date.parse(a)) && Number.isFinite(Date.parse(e)) && Date.parse(a) <= Date.parse(e),
  age_lte_seconds: (a, e, ctx) => {
    if (!isStr(a) || !isNum(e)) return false;
    const t = Date.parse(a); if (!Number.isFinite(t)) return false;
    return ((ctx?.nowMs ?? Date.now()) - t) / 1000 <= e;
  },
  not_future_beyond_seconds: (a, e, ctx) => {
    if (!isStr(a) || !isNum(e)) return false;
    const t = Date.parse(a); if (!Number.isFinite(t)) return false;
    return t - (ctx?.nowMs ?? Date.now()) <= e * 1000;
  },
  url_valid: (a) => { if (!isStr(a)) return false; try { const u = new URL(a); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } },
  url_https: (a) => { if (!isStr(a)) return false; try { return new URL(a).protocol === "https:"; } catch { return false; } },
  host_one_of: (a, e) => { if (!isStr(a) || !Array.isArray(e)) return false; try { const h = new URL(a).hostname; return e.some((d) => h === d || h.endsWith(`.${d}`)); } catch { return false; } },
});

// assertion 목록 실행. 각 항목: {path, op, value, valuePath?, quantifier?, itemPath?, label?, optional?}
// quantifier "every"/"some": path가 배열일 때 각 원소의 itemPath에 op 적용.
// optional: 대상 값이 undefined일 때 실패로 치지 않는다(존재 시에만 검사).
export function runAssertions(subject, assertions, ctx = {}) {
  const failed = [];
  for (const a of assertions || []) {
    const op = ASSERT_OPS[a.op];
    if (!op) { failed.push({ ...a, reason: `unknown op: ${a.op}` }); continue; }
    const expected = a.valuePath !== undefined ? resolvePath(subject, a.valuePath) : a.value;
    const target = resolvePath(subject, a.path);
    if (a.optional && (target === undefined || target === null)) continue;
    let ok;
    if (a.quantifier === "every" || a.quantifier === "some") {
      if (!Array.isArray(target)) ok = false;
      else {
        const test = (item) => op(a.itemPath !== undefined ? resolvePath(item, a.itemPath) : item, expected, ctx);
        // 빈 배열은 'every'에서 진공참(vacuous truth)으로 통과하면 안 된다 — 확인한 원소가 0개인데 '전부 만족'은 거짓 PASS.
        ok = a.quantifier === "every" ? (target.length > 0 && target.every(test)) : target.some(test);
      }
    } else ok = op(target, expected, ctx);
    if (!ok) {
      const actualPreview = target === undefined ? "값 없음" : JSON.stringify(target)?.slice(0, 160);
      failed.push({ path: a.path, op: a.op, expected: a.value ?? a.valuePath, actual: actualPreview, label: a.label || "" });
    }
  }
  return failed;
}
