// 브라우저 저장소(localStorage) 읽기·쓰기. 저장소를 인자로 받아서 테스트에서는 가짜 저장소를 쓴다.
import { createInitialState, dayKey } from "./core.js";

export const STORAGE_KEY = "challenge-board/v1";

/** 저장된 상태를 불러온다. 없거나 읽을 수 없으면 오늘부터 시작하는 처음 상태를 돌려준다. */
export function loadState(storage, now = new Date()) {
  const fresh = () => createInitialState(dayKey(now));
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { state: fresh(), ok: true };
    const state = JSON.parse(raw);
    if (!state || state.version !== 1 || !Array.isArray(state.items)) throw new Error("알 수 없는 저장 형식");
    return { state, ok: true };
  } catch (e) {
    return { state: fresh(), ok: false, error: String(e.message || e) };
  }
}

/** 상태를 저장한다. 저장하지 못하면 false. */
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
