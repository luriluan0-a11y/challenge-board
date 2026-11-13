// 미션·보석 계산(gas/Game.js)을 Node에서 시험한다. 시트나 인터넷은 쓰지 않는 순수 함수만.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../gas/Game.js", import.meta.url), "utf8"), ctx);
const plain = (o) => JSON.parse(JSON.stringify(o));
const fn = (name) => (...a) => plain(ctx[name](...a));
const activeMissions = fn("activeMissions");
const gemOdds = fn("gemOdds");
const pickGem = fn("pickGem");
const pointBalance = fn("pointBalance");
const gemSummary = fn("gemSummary");
const checkProof = (...a) => ctx.checkProof(...a);

const SETTINGS = { "확률 투명": 40, "확률 흰색": 28, "확률 핑크": 18, "확률 골드": 10, "확률 검은색": 4 };

/* ── 미션 목록 ── */

test("미션 시트에서 '사용'이 Y인 미션만 고르고, 인증방법을 정리한다", () => {
  const rows = [
    ["portfolio", "포트폴리오", "설명1", "링크", "Y"],
    ["resume", "이력서", "설명2", " 사진 ", "y"],
    ["old", "옛 미션", "", "글", "N"],
    ["", "ID 없음", "", "글", "Y"],
    ["essay", "소감", "", "이상한값", "Y"],
  ];
  assert.deepEqual(activeMissions(rows), [
    { id: "portfolio", name: "포트폴리오", desc: "설명1", method: "링크" },
    { id: "resume", name: "이력서", desc: "설명2", method: "사진" },
    { id: "essay", name: "소감", desc: "", method: "글" },
  ]);
});

/* ── 인증 내용 확인 ── */

test("링크 미션: http(s) 주소만 받는다", () => {
  assert.equal(checkProof("링크", "https://github.com/me"), null);
  assert.equal(checkProof("링크", "  http://a.b/c  "), null);
  assert.equal(checkProof("링크", "javascript:alert(1)"), "BAD_LINK");
  assert.equal(checkProof("링크", "github.com"), "BAD_LINK");
  assert.equal(checkProof("링크", ""), "EMPTY_PROOF");
});

test("글 미션: 비어 있으면 안 되고 1000자까지", () => {
  assert.equal(checkProof("글", "오늘 이력서를 다 썼다"), null);
  assert.equal(checkProof("글", "   "), "EMPTY_PROOF");
  assert.equal(checkProof("글", "가".repeat(1001)), "TOO_LONG");
});

test("사진 미션: JPEG·PNG 사진 데이터만, 3MB까지", () => {
  assert.equal(checkProof("사진", "data:image/jpeg;base64,/9j/AAAA"), null);
  assert.equal(checkProof("사진", "data:image/png;base64,iVBORw0K"), null);
  assert.equal(checkProof("사진", "data:text/html;base64,PGh0bWw+"), "BAD_PHOTO");
  assert.equal(checkProof("사진", "https://example.com/a.jpg"), "BAD_PHOTO");
  assert.equal(checkProof("사진", ""), "EMPTY_PROOF");
  assert.equal(checkProof("사진", "data:image/jpeg;base64," + "A".repeat(4_200_000)), "TOO_LARGE");
});

/* ── 보석 확률과 뽑기 ── */

test("설정의 확률로 보석 5종류 표를 만든다 (점수 1~5)", () => {
  const odds = gemOdds(SETTINGS);
  assert.deepEqual(odds.map((g) => [g.key, g.score, g.pct]), [
    ["투명", 1, 40], ["흰색", 2, 28], ["핑크", 3, 18], ["골드", 4, 10], ["검은색", 5, 4],
  ]);
  assert.ok(odds.every((g) => g.emoji && g.name));
});

test("확률의 합이 100이 아니거나 음수가 있으면 뽑기를 막는다 (null)", () => {
  assert.equal(ctx.gemOdds({ ...SETTINGS, "확률 투명": 41 }), null);
  assert.equal(ctx.gemOdds({ ...SETTINGS, "확률 투명": -40, "확률 흰색": 108 }), null);
  assert.equal(ctx.gemOdds({}), null);
});

test("0 이상 1 미만의 난수를 확률 구간에 맞춰 보석으로 바꾼다", () => {
  const odds = gemOdds(SETTINGS);
  assert.equal(pickGem(odds, 0).key, "투명");
  assert.equal(pickGem(odds, 0.3999).key, "투명");
  assert.equal(pickGem(odds, 0.40).key, "흰색");
  assert.equal(pickGem(odds, 0.68).key, "핑크");
  assert.equal(pickGem(odds, 0.86).key, "골드");
  assert.equal(pickGem(odds, 0.96).key, "검은색");
  assert.equal(pickGem(odds, 0.999999).key, "검은색");
});

test("확률이 0%인 보석은 나오지 않는다", () => {
  const odds = gemOdds({ ...SETTINGS, "확률 투명": 0, "확률 흰색": 68 });
  assert.equal(pickGem(odds, 0).key, "흰색");
});

/* ── 포인트 ── */

test("포인트 = 미션 인증 수 × 미션 포인트 − 뽑기에 쓴 포인트", () => {
  assert.deepEqual(pointBalance(3, 20, [30, 30]), { earned: 60, spent: 60, balance: 0 });
  assert.deepEqual(pointBalance(0, 20, []), { earned: 0, spent: 0, balance: 0 });
  assert.deepEqual(pointBalance(2, 20, ["30", ""]), { earned: 40, spent: 30, balance: 10 });
});

/* ── 내 보석함 ── */

test("내 보석함: 종류별 개수, 점수 합계, 5종류를 모두 모으면 컴플리트", () => {
  const odds = gemOdds(SETTINGS);
  const some = gemSummary(odds, ["투명", "투명", "골드"]);
  assert.deepEqual(some.counts, { 투명: 2, 흰색: 0, 핑크: 0, 골드: 1, 검은색: 0 });
  assert.equal(some.score, 2 * 1 + 4);
  assert.equal(some.kinds, 2);
  assert.equal(some.complete, false);

  const all = gemSummary(odds, ["투명", "흰색", "핑크", "골드", "검은색", "흰색"]);
  assert.equal(all.complete, true);
  assert.equal(all.score, 1 + 2 + 3 + 4 + 5 + 2);
});

test("확률 설정이 망가져도 보석함 점수는 계산한다", () => {
  const s = gemSummary(null, ["검은색"]);
  assert.equal(s.score, 5);
  assert.equal(s.counts.검은색, 1);
});
