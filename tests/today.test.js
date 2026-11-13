import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, activeItems, completion } from "../src/core.js";

const DAY = "2026-11-13";

test("처음 상태에는 매일 항목 9개가 순서대로 있다", () => {
  const s = createInitialState(DAY);
  assert.deepEqual(
    s.items.map((i) => i.name),
    ["아침 영양제", "산책 30분", "스픽", "듀오링고", "컴퓨터활용능력", "더캠프", "저녁 영양제", "지원 건수", "코드·AI 공부"]
  );
});

test("'지원 건수'만 건수를 세는 항목이다", () => {
  const s = createInitialState(DAY);
  const counted = s.items.filter((i) => i.kind === "count").map((i) => i.name);
  assert.deepEqual(counted, ["지원 건수"]);
});

test("처음 상태의 기본 설정: 새벽 4시, 포인트 규칙", () => {
  const s = createInitialState(DAY);
  assert.equal(s.settings.dayStartHour, 4);
  assert.deepEqual(s.settings.points, { check: 10, allBonus: 30, missionLog: 20, memo: 5, badge: 50 });
});

test("처음 상태의 보상 3개와 미션 2개", () => {
  const s = createInitialState(DAY);
  assert.deepEqual(s.rewards.map((r) => [r.name, r.cost]), [["라떼 한 잔", 100], ["게임 1시간", 150], ["디저트", 200]]);
  assert.deepEqual(s.missions.map((m) => m.name), ["명령어 입력 연습 7개", "프로그래밍 공부"]);
});

test("항목은 시작한 날부터 센다 (시작 전 날짜에는 없다)", () => {
  const s = createInitialState(DAY);
  assert.equal(activeItems(s, DAY).length, 9);
  assert.equal(activeItems(s, "2026-11-12").length, 0);
});

test("숨긴 항목은 숨긴 날부터 빠지고, 그 전 날짜에는 남아 있다", () => {
  const s = createInitialState(DAY);
  s.items[2].hiddenFrom = "2026-11-20";
  assert.equal(activeItems(s, "2026-11-19").length, 9);
  assert.equal(activeItems(s, "2026-11-20").length, 8);
});

test("아무것도 체크하지 않은 날의 달성률은 0", () => {
  const s = createInitialState(DAY);
  assert.deepEqual(completion(s, DAY), { done: 0, total: 9, rate: 0 });
});

test("체크한 항목 수로 달성률을 계산한다", () => {
  const s = createInitialState(DAY);
  s.days[DAY] = { checks: { [s.items[0].id]: true, [s.items[1].id]: true, [s.items[2].id]: true }, counts: {}, memo: "" };
  const c = completion(s, DAY);
  assert.equal(c.done, 3);
  assert.equal(c.total, 9);
  assert.ok(Math.abs(c.rate - 3 / 9) < 1e-9);
});

test("숨긴 항목의 체크는 달성률에 들어가지 않는다", () => {
  const s = createInitialState(DAY);
  s.items[0].hiddenFrom = DAY;
  s.days[DAY] = { checks: { [s.items[0].id]: true, [s.items[1].id]: true }, counts: {}, memo: "" };
  assert.deepEqual(completion(s, DAY), { done: 1, total: 8, rate: 1 / 8 });
});
