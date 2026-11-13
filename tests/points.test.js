import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, toggleCheck, setCount, setMemo, dayPoints, earnedPoints } from "../src/core.js";

const DAY = "2026-11-13";
const fresh = () => createInitialState(DAY);

test("체크하면 켜지고, 다시 누르면 꺼진다", () => {
  let s = toggleCheck(fresh(), DAY, "walk");
  assert.equal(s.days[DAY].checks.walk, true);
  s = toggleCheck(s, DAY, "walk");
  assert.equal(Boolean(s.days[DAY].checks.walk), false);
});

test("상태를 직접 바꾸지 않고 새 상태를 돌려준다", () => {
  const s0 = fresh();
  toggleCheck(s0, DAY, "walk");
  assert.deepEqual(s0.days, {});
});

test("'지원 건수'를 체크하면 건수가 1로 시작하고, 끄면 건수도 지워진다", () => {
  let s = toggleCheck(fresh(), DAY, "apply");
  assert.equal(s.days[DAY].counts.apply, 1);
  s = toggleCheck(s, DAY, "apply");
  assert.equal(s.days[DAY].counts.apply, undefined);
});

test("건수를 바꿀 수 있고, 0 이하로 내리면 체크가 꺼진다", () => {
  let s = setCount(toggleCheck(fresh(), DAY, "apply"), DAY, "apply", 3);
  assert.equal(s.days[DAY].counts.apply, 3);
  s = setCount(s, DAY, "apply", 0);
  assert.equal(Boolean(s.days[DAY].checks.apply), false);
  assert.equal(s.days[DAY].counts.apply, undefined);
});

test("건수를 적으면 체크도 켜진다", () => {
  const s = setCount(fresh(), DAY, "apply", 2);
  assert.equal(s.days[DAY].checks.apply, true);
  assert.equal(s.days[DAY].counts.apply, 2);
});

test("한 줄 메모를 저장하고 고칠 수 있다", () => {
  let s = setMemo(fresh(), DAY, "오늘은 TDD를 처음 해 봤다");
  assert.equal(s.days[DAY].memo, "오늘은 TDD를 처음 해 봤다");
  s = setMemo(s, DAY, "고친 메모");
  assert.equal(s.days[DAY].memo, "고친 메모");
});

test("아무것도 안 한 날은 0점", () => {
  assert.equal(dayPoints(fresh(), DAY), 0);
});

test("항목 체크 하나에 10점, 건수와 상관없이 10점", () => {
  let s = toggleCheck(fresh(), DAY, "walk");
  assert.equal(dayPoints(s, DAY), 10);
  s = setCount(s, DAY, "apply", 5);
  assert.equal(dayPoints(s, DAY), 20);
});

test("메모를 쓰면 5점, 빈칸이나 공백만 있으면 0점", () => {
  assert.equal(dayPoints(setMemo(fresh(), DAY, "한 줄"), DAY), 5);
  assert.equal(dayPoints(setMemo(fresh(), DAY, "   "), DAY), 0);
});

test("모두 체크하면 9개 × 10 + 보너스 30 = 120점", () => {
  let s = fresh();
  for (const i of s.items) s = toggleCheck(s, DAY, i.id);
  assert.equal(dayPoints(s, DAY), 120);
});

test("체크를 하나 풀면 보너스도 빠진다", () => {
  let s = fresh();
  for (const i of s.items) s = toggleCheck(s, DAY, i.id);
  s = toggleCheck(s, DAY, "walk");
  assert.equal(dayPoints(s, DAY), 80);
});

test("미션에 기록하면 미션마다 하루 한 번 20점", () => {
  const s = fresh();
  s.missions[0].logs.push({ day: DAY, text: "ls 해 봄" }, { day: DAY, text: "cd 해 봄" });
  s.missions[1].logs.push({ day: DAY, text: "유튜브 강의", link: "https://youtu.be/x" });
  assert.equal(dayPoints(s, DAY), 40);
});

test("포인트 숫자는 설정을 따른다", () => {
  const s = toggleCheck(fresh(), DAY, "walk");
  s.settings.points.check = 15;
  assert.equal(dayPoints(s, DAY), 15);
});

test("모은 포인트는 기록이 있는 모든 날의 합 (미션만 기록한 날 포함)", () => {
  let s = toggleCheck(fresh(), DAY, "walk");
  s = setMemo(s, "2026-11-14", "둘째 날");
  s.missions[1].logs.push({ day: "2026-11-15", text: "공부" });
  assert.equal(earnedPoints(s), 10 + 5 + 20);
});
