/**
 * 미션·보석 계산 (앱스 스크립트용).
 * 시트나 인터넷에 접근하지 않는 순수 함수만 둔다. Node 테스트(tests/gas-game.test.js)로 검사한다.
 * 붙여 넣는 곳: Apps Script 새 스크립트 파일 "Game.gs"
 */

const PROOF_METHODS = ["사진", "링크", "글"];
const PROOF_TEXT_MAX = 1000;
const PROOF_PHOTO_MAX = 4_000_000; // 사진 데이터 글자 수 (약 3MB)

/** 보석 5종류. 확률은 시트 "설정"의 "확률 ○○" 줄에서 읽는다. */
const GEMS = [
  { key: "투명", name: "투명 보석", emoji: "💎", score: 1 },
  { key: "흰색", name: "흰색 진주", emoji: "⚪", score: 2 },
  { key: "핑크", name: "핑크 보석", emoji: "🩷", score: 3 },
  { key: "골드", name: "골드 보석", emoji: "🟡", score: 4 },
  { key: "검은색", name: "검은 진주", emoji: "⚫", score: 5 },
];

/** 미션 시트 줄([ID, 이름, 설명, 인증방법, 사용])에서 사용 중인 미션만. 인증방법이 이상하면 "글". */
function activeMissions(rows) {
  const out = [];
  rows.forEach((r) => {
    const id = String(r[0] || "").trim();
    if (!id || String(r[4] || "").trim().toUpperCase() !== "Y") return;
    const method = String(r[3] || "").trim();
    out.push({
      id: id,
      name: String(r[1] || "").trim(),
      desc: String(r[2] || "").trim(),
      method: PROOF_METHODS.indexOf(method) === -1 ? "글" : method,
    });
  });
  return out;
}

/** 인증 내용 확인. 문제가 없으면 null, 있으면 오류 코드. */
function checkProof(method, content) {
  const text = String(content || "").trim();
  if (!text) return "EMPTY_PROOF";
  if (method === "링크") {
    return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(text) ? null : "BAD_LINK";
  }
  if (method === "사진") {
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(text)) return "BAD_PHOTO";
    return text.length > PROOF_PHOTO_MAX ? "TOO_LARGE" : null;
  }
  return text.length > PROOF_TEXT_MAX ? "TOO_LONG" : null;
}

/** 설정에서 보석 확률표를 만든다. 합이 100이 아니거나 음수·숫자 아님이 있으면 null (뽑기를 막는다). */
function gemOdds(settings) {
  let sum = 0;
  const odds = GEMS.map((g) => {
    const raw = settings ? settings["확률 " + g.key] : undefined;
    const pct = raw === "" || raw === undefined || raw === null ? NaN : Number(raw);
    sum += pct;
    return { key: g.key, name: g.name, emoji: g.emoji, score: g.score, pct: pct };
  });
  if (odds.some((g) => !isFinite(g.pct) || g.pct < 0)) return null;
  if (Math.abs(sum - 100) > 1e-9) return null;
  return odds;
}

/** 0 이상 1 미만의 난수 r을 확률 구간에 맞춰 보석으로 바꾼다. */
function pickGem(odds, r) {
  // 0.4 + 0.28 + 0.18 = 0.8600000000000001 같은 오차를 피하려고 퍼센트(정수) 단위로 더한다.
  const target = r * 100;
  let acc = 0;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i].pct;
    if (odds[i].pct > 0 && target < acc) return odds[i];
  }
  // 소수 계산 오차로 끝까지 왔으면 확률이 0이 아닌 마지막 보석
  for (let i = odds.length - 1; i >= 0; i--) if (odds[i].pct > 0) return odds[i];
  return odds[odds.length - 1];
}

/** 포인트 = 미션 인증 수 × 미션 포인트 − 뽑기에 쓴 포인트. */
function pointBalance(proofCount, missionPoints, spentList) {
  const earned = proofCount * (Number(missionPoints) || 0);
  const spent = spentList.reduce((a, x) => a + (Number(x) || 0), 0);
  return { earned: earned, spent: spent, balance: earned - spent };
}

/** 내 보석함: 종류별 개수, 점수 합계, 모은 종류 수, 컴플리트(5종류 모두). */
function gemSummary(odds, gemKeys) {
  const counts = {};
  GEMS.forEach((g) => { counts[g.key] = 0; });
  let score = 0;
  gemKeys.forEach((k) => {
    const gem = GEMS.find((g) => g.key === k);
    if (!gem) return;
    counts[k] += 1;
    score += gem.score;
  });
  const kinds = GEMS.filter((g) => counts[g.key] > 0).length;
  return { counts: counts, score: score, kinds: kinds, complete: kinds === GEMS.length };
}
