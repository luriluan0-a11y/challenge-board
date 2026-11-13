import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey } from "../src/core.js";

test("낮 시간은 그날 날짜다", () => {
  assert.equal(dayKey(new Date(2026, 10, 13, 15, 0)), "2026-11-13");
});

test("새벽 4시 전은 전날 기록이다", () => {
  assert.equal(dayKey(new Date(2026, 10, 14, 1, 30)), "2026-11-13");
  assert.equal(dayKey(new Date(2026, 10, 14, 3, 59)), "2026-11-13");
});

test("새벽 4시부터는 새 날이다", () => {
  assert.equal(dayKey(new Date(2026, 10, 14, 4, 0)), "2026-11-14");
});

test("하루 바뀌는 시각을 바꿀 수 있다 (0시 = 자정 기준)", () => {
  assert.equal(dayKey(new Date(2026, 10, 14, 1, 30), 0), "2026-11-14");
});

test("달과 해가 넘어가도 전날로 계산한다", () => {
  assert.equal(dayKey(new Date(2027, 0, 1, 2, 0)), "2026-12-31");
});
