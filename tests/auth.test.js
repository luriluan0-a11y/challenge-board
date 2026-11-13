// 화면 쪽 로그인 계산: 서버 요청, 세션 저장, 서버 답에 따라 보여 줄 화면 고르기
import { test } from "node:test";
import assert from "node:assert/strict";
import { callApi, loadSession, saveSession, clearSession, SESSION_KEY, loginStep } from "../src/auth.js";

const memoryStorage = (init = {}) => {
  const data = { ...init };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
};

/* ── 서버 요청 ── */

test("서버에는 POST로, 본문은 JSON 글자(text/plain)로 보낸다", async () => {
  let seen;
  const fakeFetch = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await callApi(fakeFetch, "https://example.com/exec", { action: "me", session: "abc" });
  assert.equal(seen.url, "https://example.com/exec");
  assert.equal(seen.opts.method, "POST");
  // application/json으로 보내면 브라우저가 사전 확인(preflight)을 보내는데 앱스 스크립트는 받지 못한다.
  assert.equal(seen.opts.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.deepEqual(JSON.parse(seen.opts.body), { action: "me", session: "abc" });
});

test("서버의 답을 그대로 돌려준다", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ ok: false, code: "NEED_NAME", message: "이름" }) });
  const res = await callApi(fakeFetch, "u", { action: "login" });
  assert.deepEqual(res, { ok: false, code: "NEED_NAME", message: "이름" });
});

test("인터넷이 끊기면 멈추지 않고 NETWORK 오류를 돌려준다", async () => {
  const fakeFetch = async () => { throw new TypeError("Failed to fetch"); };
  const res = await callApi(fakeFetch, "u", { action: "me" });
  assert.equal(res.ok, false);
  assert.equal(res.code, "NETWORK");
  assert.ok(res.message);
});

test("서버가 오류 상태(500 등)나 JSON이 아닌 답을 주면 SERVER_ERROR", async () => {
  const bad = await callApi(async () => ({ ok: false, status: 500, json: async () => ({}) }), "u", {});
  assert.equal(bad.code, "SERVER_ERROR");
  const notJson = await callApi(async () => ({ ok: true, json: async () => { throw new SyntaxError("x"); } }), "u", {});
  assert.equal(notJson.code, "SERVER_ERROR");
});

/* ── 세션 저장 ── */

test("세션을 저장하고 다시 읽고 지운다", () => {
  const store = memoryStorage();
  assert.equal(loadSession(store), null);
  saveSession(store, "tok-123");
  assert.equal(store.data[SESSION_KEY], "tok-123");
  assert.equal(loadSession(store), "tok-123");
  clearSession(store);
  assert.equal(loadSession(store), null);
});

test("저장소를 쓸 수 없어도(사생활 보호 모드 등) 멈추지 않는다", () => {
  const broken = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
  assert.equal(loadSession(broken), null);
  assert.equal(saveSession(broken, "t"), false);
  assert.doesNotThrow(() => clearSession(broken));
  assert.equal(loadSession(null), null);
});

/* ── 서버 답 → 보여 줄 화면 ── */

test("로그인에 성공하면 보드를 보여 주고 학생 정보를 넘긴다", () => {
  const step = loginStep({ ok: true, session: "s", student: { name: "홍길동", email: "a@b.c" }, semester: "2026-2" });
  assert.equal(step.screen, "board");
  assert.equal(step.session, "s");
  assert.deepEqual(step.student, { name: "홍길동", email: "a@b.c" });
});

test("처음 로그인이면 이름 입력 화면", () => {
  const step = loginStep({ ok: false, code: "NEED_NAME", message: "처음 로그인이에요." });
  assert.equal(step.screen, "name");
  assert.equal(step.message, "처음 로그인이에요.");
});

test("이름이 틀리면 이름 입력 화면에 다시 머문다", () => {
  const step = loginStep({ ok: false, code: "NAME_MISMATCH", message: "이름이 명단과 달라요." });
  assert.equal(step.screen, "name");
  assert.equal(step.message, "이름이 명단과 달라요.");
});

test("명단에 없는 계정이면 로그인 화면에 메시지와 이메일을 보여 준다", () => {
  const step = loginStep({ ok: false, code: "NOT_REGISTERED", message: "등록되지 않은 계정이에요.", email: "x@y.z" });
  assert.equal(step.screen, "login");
  assert.match(step.message, /등록되지 않은 계정/);
  assert.match(step.message, /x@y\.z/);
});

test("그 밖의 오류는 로그인 화면에 서버 메시지를 보여 준다", () => {
  for (const code of ["INVALID_TOKEN", "SESSION_EXPIRED", "SERVER_NOT_CONFIGURED", "NETWORK", "SERVER_ERROR"]) {
    const step = loginStep({ ok: false, code, message: `${code} 메시지` });
    assert.equal(step.screen, "login", code);
    assert.equal(step.message, `${code} 메시지`);
  }
});

test("메시지가 없는 답이 와도 빈 화면이 되지 않는다", () => {
  const step = loginStep({ ok: false, code: "UNKNOWN" });
  assert.equal(step.screen, "login");
  assert.ok(step.message);
  assert.equal(loginStep(null).screen, "login");
});
