import { test } from "node:test";
import assert from "node:assert/strict";
import { loadState, saveState, STORAGE_KEY } from "../src/storage.js";
import { createInitialState, toggleCheck } from "../src/core.js";

const memoryStorage = (init = {}) => {
  const data = { ...init };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};
const NOW = new Date(2026, 10, 13, 21, 0);

test("저장된 기록이 없으면 오늘부터 시작하는 처음 상태를 만든다", () => {
  const { state, ok } = loadState(memoryStorage(), NOW);
  assert.equal(ok, true);
  assert.equal(state.startDay, "2026-11-13");
  assert.equal(state.items.length, 9);
});

test("저장한 기록을 다시 불러온다", () => {
  const store = memoryStorage();
  const s = toggleCheck(createInitialState("2026-11-13"), "2026-11-13", "walk");
  assert.equal(saveState(store, s), true);
  assert.deepEqual(loadState(store, NOW).state, s);
});

test("저장소가 망가진 글자를 갖고 있어도 멈추지 않고 알려 준다", () => {
  const { state, ok, error } = loadState(memoryStorage({ [STORAGE_KEY]: "{망가짐" }), NOW);
  assert.equal(ok, false);
  assert.ok(error);
  assert.equal(state.items.length, 9);
});

test("저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등)에서도 멈추지 않는다", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const { state, ok } = loadState(broken, NOW);
  assert.equal(ok, false);
  assert.equal(state.items.length, 9);
  assert.equal(saveState(broken, state), false);
});
