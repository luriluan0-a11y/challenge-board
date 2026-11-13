// 앱스 스크립트용 계산 파일(gas/Auth.js)을 Node에서 불러와 시험한다.
// 앱스 스크립트는 import를 쓰지 않으므로, 파일을 그대로 읽어 별도 공간(vm)에서 실행한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../gas/Auth.js", import.meta.url), "utf8"), ctx);
const { normalizeEmail, normalizeName, findStudent, checkTokenClaims, sessionExpiry, isSessionValid } = ctx;
// vm 안에서 만든 객체는 종류(prototype)가 달라서, 비교 전에 일반 객체로 바꾼다.
const plain = (o) => JSON.parse(JSON.stringify(o));
const decideLogin = (...a) => plain(ctx.decideLogin(...a));

const ROSTER = [
  ["Kim.Student@gmail.com", "김학생", ""],
  ["lee@example.com", "이 하 늘", "2026-11-13"],
];
const CLIENT_ID = "123-abc.apps.googleusercontent.com";
const NOW = 1_763_000_000; // 초

test("이메일은 앞뒤 공백을 지우고 소문자로 맞춘다", () => {
  assert.equal(normalizeEmail("  Kim.Student@Gmail.COM "), "kim.student@gmail.com");
});

test("이름은 모든 띄어쓰기를 지워서 비교한다", () => {
  assert.equal(normalizeName(" 이 하 늘 "), "이하늘");
  assert.equal(normalizeName("김학생"), normalizeName("김 학생"));
});

test("명단에서 이메일로 학생을 찾는다 (대소문자 무시)", () => {
  const s = findStudent(ROSTER, "kim.student@gmail.com");
  assert.equal(s.row, 0);
  assert.equal(s.name, "김학생");
  assert.equal(s.nameVerified, false);
  assert.equal(findStudent(ROSTER, "lee@example.com").nameVerified, true);
});

test("명단에 없으면 null", () => {
  assert.equal(findStudent(ROSTER, "nobody@gmail.com"), null);
});

test("빈 줄과 이메일 칸이 빈 줄은 건너뛴다", () => {
  assert.equal(findStudent([["", "이름만", ""], ["kim.student@gmail.com", "김학생", ""]], "kim.student@gmail.com").row, 1);
});

const goodClaims = () => ({
  aud: CLIENT_ID, iss: "https://accounts.google.com", email: "kim.student@gmail.com",
  email_verified: "true", exp: String(NOW + 600),
});

test("정상 구글 로그인 토큰은 통과 (오류 없음)", () => {
  assert.equal(checkTokenClaims(goodClaims(), CLIENT_ID, NOW), null);
  assert.equal(checkTokenClaims({ ...goodClaims(), iss: "accounts.google.com", email_verified: true }, CLIENT_ID, NOW), null);
});

test("다른 앱용으로 발급된 토큰은 거절", () => {
  assert.equal(checkTokenClaims({ ...goodClaims(), aud: "other-app" }, CLIENT_ID, NOW), "WRONG_AUDIENCE");
});

test("구글이 발급하지 않은 토큰은 거절", () => {
  assert.equal(checkTokenClaims({ ...goodClaims(), iss: "https://evil.example.com" }, CLIENT_ID, NOW), "WRONG_ISSUER");
});

test("이메일 확인이 안 된 계정은 거절", () => {
  assert.equal(checkTokenClaims({ ...goodClaims(), email_verified: "false" }, CLIENT_ID, NOW), "EMAIL_NOT_VERIFIED");
});

test("시간이 지난 토큰은 거절", () => {
  assert.equal(checkTokenClaims({ ...goodClaims(), exp: String(NOW - 1) }, CLIENT_ID, NOW), "TOKEN_EXPIRED");
});

test("서버에 클라이언트 ID가 설정되지 않았으면 거절", () => {
  assert.equal(checkTokenClaims(goodClaims(), "", NOW), "SERVER_NOT_CONFIGURED");
});

test("명단에 없는 이메일은 들어올 수 없다", () => {
  assert.deepEqual(decideLogin(null, ""), { code: "NOT_REGISTERED", markVerified: false });
});

test("이름 확인 전이고 이름을 안 보냈으면 이름을 물어본다", () => {
  const s = findStudent(ROSTER, "kim.student@gmail.com");
  assert.deepEqual(decideLogin(s, ""), { code: "NEED_NAME", markVerified: false });
  assert.deepEqual(decideLogin(s, "   "), { code: "NEED_NAME", markVerified: false });
});

test("입력한 이름이 명단과 다르면 거절", () => {
  const s = findStudent(ROSTER, "kim.student@gmail.com");
  assert.deepEqual(decideLogin(s, "박학생"), { code: "NAME_MISMATCH", markVerified: false });
});

test("이름이 맞으면 들어오고, 이름 확인을 기록한다 (띄어쓰기 무시)", () => {
  const s = findStudent(ROSTER, "kim.student@gmail.com");
  assert.deepEqual(decideLogin(s, "김 학생"), { code: "OK", markVerified: true });
});

test("이미 이름을 확인한 학생은 이름 없이 바로 들어온다", () => {
  const s = findStudent(ROSTER, "lee@example.com");
  assert.deepEqual(decideLogin(s, ""), { code: "OK", markVerified: false });
});

test("세션은 정해진 날 수 뒤에 끝난다", () => {
  const nowMs = Date.UTC(2026, 10, 13, 9, 0);
  assert.equal(sessionExpiry(nowMs, 14), nowMs + 14 * 24 * 60 * 60 * 1000);
});

test("세션이 끝나기 전에만 유효하다", () => {
  assert.equal(isSessionValid(2000, 1999), true);
  assert.equal(isSessionValid(2000, 2000), false);
  assert.equal(isSessionValid("", 1), false);
});
