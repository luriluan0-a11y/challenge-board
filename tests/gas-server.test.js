// 앱스 스크립트 본체(gas/Code.js + gas/Auth.js)를 가짜 구글 서비스 위에서 돌려 로그인 흐름 전체를 시험한다.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";

const CLIENT_ID = "123-abc.apps.googleusercontent.com";

/* ── 가짜 시트 ── */
class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.data[this.r - 1 + i]?.[this.c - 1 + j] ?? "");
      out.push(row);
    }
    return out;
  }
  setValues(v) {
    v.forEach((row, i) => row.forEach((x, j) => this.sheet.set(this.r + i, this.c + j, x)));
    return this;
  }
  setValue(x) { this.sheet.set(this.r, this.c, x); return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
}
class FakeSheet {
  constructor(name) { this.name = name; this.data = []; this.hidden = false; }
  getName() { return this.name; }
  set(r, c, x) {
    while (this.data.length < r) this.data.push([]);
    this.data[r - 1][c - 1] = x;
  }
  getLastRow() { return this.data.length; }
  getRange(r, c, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  getDataRange() {
    const nc = Math.max(1, ...this.data.map((row) => row.length));
    return new FakeRange(this, 1, 1, Math.max(1, this.data.length), nc);
  }
  appendRow(row) { this.data.push([...row]); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows() {}
  autoResizeColumns() {}
  hideSheet() { this.hidden = true; }
}
class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet("시트1")]; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) ?? null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return [...this.sheets]; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  setActiveSheet() {}
}

/* ── 가짜 구글 서비스와 실행 공간 ── */
let ss, tokens, ctx;
function load() {
  ss = new FakeSpreadsheet();
  tokens = {}; // 가짜 구글 로그인 토큰 → tokeninfo 결과
  ctx = {
    console: { error() {}, log() {} },
    Logger: { log() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error("화면 없음"); } },
    UrlFetchApp: {
      fetch(url) {
        const t = decodeURIComponent(url.split("id_token=")[1] || "");
        const claims = tokens[t];
        return { getResponseCode: () => (claims ? 200 : 400), getContentText: () => JSON.stringify(claims ?? { error: "invalid" }) };
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (alg, text) => [...createHash("sha256").update(text, "utf8").digest()].map((b) => (b > 127 ? b - 256 : b)),
      formatDate: () => "2026-11-13 21:00",
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  for (const f of ["../gas/Auth.js", "../gas/Code.js"]) vm.runInContext(readFileSync(new URL(f, import.meta.url), "utf8"), ctx);
}
const call = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).content);
const sheet = (n) => ss.getSheetByName(n);
const setSetting = (key, value) => {
  const s = sheet("설정");
  const i = s.data.findIndex((r) => r[0] === key);
  s.data[i][1] = value;
};
const googleToken = (email, extra = {}) => {
  const t = `token-${email}-${Math.random()}`;
  tokens[t] = { aud: CLIENT_ID, iss: "https://accounts.google.com", email, email_verified: "true", exp: String(Math.floor(Date.now() / 1000) + 600), ...extra };
  return t;
};
const addStudent = (email, name) => sheet("학생명단").appendRow([email, name, "", ""]);

beforeEach(() => {
  load();
  ctx.setupSheets();
});

test("처음 설정: 필요한 탭 8개를 만들고 빈 '시트1'은 지운다", () => {
  assert.deepEqual(ss.getSheets().map((s) => s.name), ["학생명단", "매일챌린지", "미션", "설정", "세션", "체크기록", "미션인증", "보석뽑기"]);
  assert.deepEqual(sheet("학생명단").data[0], ["이메일", "이름", "이름확인", "메모"]);
  assert.equal(sheet("세션").hidden, true);
});

test("처음 설정을 다시 해도 적어 둔 내용은 그대로", () => {
  addStudent("a@gmail.com", "가나다");
  ctx.setupSheets();
  assert.equal(sheet("학생명단").data.at(-1)[0], "a@gmail.com");
});

test("주소 확인(doGet)", () => {
  assert.deepEqual(JSON.parse(ctx.doGet().content), { ok: true, service: "challenge-board" });
});

test("클라이언트 ID를 설정하기 전에는 로그인할 수 없다", () => {
  const r = call({ action: "login", idToken: googleToken("a@gmail.com") });
  assert.equal(r.code, "SERVER_NOT_CONFIGURED");
});

test("가짜·잘못된 토큰은 거절", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  assert.equal(call({ action: "login", idToken: "made-up" }).code, "INVALID_TOKEN");
  assert.equal(call({ action: "login", idToken: googleToken("a@gmail.com", { aud: "other" }) }).code, "INVALID_TOKEN");
});

test("명단에 없는 계정은 거절하고, 선생님께 알릴 이메일을 보여 준다", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  const r = call({ action: "login", idToken: googleToken("Nobody@Gmail.com") });
  assert.equal(r.ok, false);
  assert.equal(r.code, "NOT_REGISTERED");
  assert.equal(r.email, "nobody@gmail.com");
  assert.match(r.message, /등록되지 않은/);
});

test("처음 로그인: 이름을 묻고 → 틀리면 거절 → 맞으면 들어오고 이름확인을 적는다", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  addStudent("kim@gmail.com", "김학생");
  assert.equal(call({ action: "login", idToken: googleToken("kim@gmail.com") }).code, "NEED_NAME");
  assert.equal(call({ action: "login", idToken: googleToken("kim@gmail.com"), name: "박학생" }).code, "NAME_MISMATCH");
  const r = call({ action: "login", idToken: googleToken("kim@gmail.com"), name: "김 학생" });
  assert.equal(r.ok, true);
  assert.equal(r.student.name, "김학생");
  assert.equal(r.semester, "2026-2");
  assert.ok(r.session.length >= 64);
  const row = sheet("학생명단").data.find((x) => x[0] === "kim@gmail.com");
  assert.equal(row[2], "2026-11-13 21:00");
});

test("이름을 한 번 확인한 학생은 다음부터 이름 없이 들어온다", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  addStudent("kim@gmail.com", "김학생");
  call({ action: "login", idToken: googleToken("kim@gmail.com"), name: "김학생" });
  assert.equal(call({ action: "login", idToken: googleToken("kim@gmail.com") }).ok, true);
});

test("세션 시트에는 토큰 원문이 아니라 해시만 저장한다", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  addStudent("kim@gmail.com", "김학생");
  const r = call({ action: "login", idToken: googleToken("kim@gmail.com"), name: "김학생" });
  const stored = sheet("세션").data.slice(1).map((x) => x[0]);
  assert.equal(stored.length, 1);
  assert.notEqual(stored[0], r.session);
  assert.match(stored[0], /^[0-9a-f]{64}$/);
});

test("세션으로 내 정보를 확인하고, 로그아웃하면 더는 쓸 수 없다", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  addStudent("kim@gmail.com", "김학생");
  const { session } = call({ action: "login", idToken: googleToken("kim@gmail.com"), name: "김학생" });
  assert.equal(call({ action: "me", session }).student.name, "김학생");
  assert.equal(call({ action: "logout", session }).ok, true);
  assert.equal(call({ action: "me", session }).code, "SESSION_EXPIRED");
});

test("명단에서 지운 학생은 세션이 남아 있어도 거절", () => {
  setSetting("로그인 클라이언트 ID", CLIENT_ID);
  addStudent("kim@gmail.com", "김학생");
  const { session } = call({ action: "login", idToken: googleToken("kim@gmail.com"), name: "김학생" });
  const roster = sheet("학생명단");
  roster.data = roster.data.filter((x) => x[0] !== "kim@gmail.com");
  assert.equal(call({ action: "me", session }).code, "SESSION_EXPIRED");
});

test("만든 적 없는 세션과 이상한 요청은 거절", () => {
  assert.equal(call({ action: "me", session: "nope" }).code, "SESSION_EXPIRED");
  assert.equal(call({ action: "hack" }).code, "BAD_REQUEST");
  assert.equal(JSON.parse(ctx.doPost({ postData: { contents: "{망가짐" } }).content).code, "BAD_REQUEST");
});
