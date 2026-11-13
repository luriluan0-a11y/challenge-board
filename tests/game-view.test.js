// 미션·보석 화면 계산 (src/game.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitSize, gemSlots, drawState, proofForm } from "../src/game.js";

test("사진 크기: 긴 쪽을 max에 맞춰 줄이고, 작은 사진은 그대로", () => {
  assert.deepEqual(fitSize(4000, 3000, 1280), { width: 1280, height: 960 });
  assert.deepEqual(fitSize(1000, 3000, 1280), { width: 427, height: 1280 });
  assert.deepEqual(fitSize(800, 600, 1280), { width: 800, height: 600 });
});

test("보석함 칸: 5종류마다 확률·점수·내 개수", () => {
  const odds = [
    { key: "투명", name: "투명 보석", emoji: "💎", score: 1, pct: 40 },
    { key: "검은색", name: "검은 진주", emoji: "⚫", score: 5, pct: 60 },
  ];
  const summary = { counts: { 투명: 2, 검은색: 0 }, score: 2, kinds: 1, complete: false };
  assert.deepEqual(gemSlots(odds, summary), [
    { key: "투명", name: "투명 보석", emoji: "💎", score: 1, pct: 40, count: 2, owned: true },
    { key: "검은색", name: "검은 진주", emoji: "⚫", score: 5, pct: 60, count: 0, owned: false },
  ]);
  assert.deepEqual(gemSlots([], summary), []);
});

test("뽑기 버튼: 포인트가 비용 이상이고 확률이 정해졌을 때만", () => {
  assert.deepEqual(drawState({ balance: 40 }, 30, true), { enabled: true, label: "보석 뽑기 (−30)" });
  const low = drawState({ balance: 20 }, 30, true);
  assert.equal(low.enabled, false);
  assert.match(low.label, /10포인트 더/);
  const notReady = drawState({ balance: 99 }, 30, false);
  assert.equal(notReady.enabled, false);
  assert.match(notReady.label, /준비 중/);
});

test("인증 입력칸: 미션 인증방법에 맞는 입력 종류", () => {
  assert.equal(proofForm("사진").input, "file");
  assert.equal(proofForm("링크").input, "url");
  assert.equal(proofForm("글").input, "textarea");
  assert.equal(proofForm("이상한값").input, "textarea");
  for (const m of ["사진", "링크", "글"]) assert.ok(proofForm(m).hint, m);
});
