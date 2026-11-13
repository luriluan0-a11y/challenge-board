// 미션 인증·갤러리·보석 뽑기 요청 흐름을 가짜 시트·드라이브 위에서 시험한다.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createGas } from "./helpers/fake-gas.js";

let g, kim, lee;
const PHOTO = "data:image/jpeg;base64," + Buffer.from("가짜 사진 바이트").toString("base64");

beforeEach(() => {
  g = createGas();
  // 예시 미션: portfolio(링크), resume(사진). 글 미션도 하나 더한다.
  g.sheet("미션").appendRow(["essay", "한 주 돌아보기", "느낀 점을 글로", "글", "Y"]);
  g.sheet("미션").appendRow(["off", "꺼 둔 미션", "", "글", "N"]);
  kim = g.login("kim@gmail.com", "김학생");
  lee = g.login("lee@gmail.com", "이학생");
});

/* ── 로그인 확인 ── */

test("세션이 없거나 틀리면 미션·보석 요청을 모두 거절한다", () => {
  for (const action of ["missions", "submitProof", "gallery", "proofImage", "gems", "draw"]) {
    assert.equal(g.call({ action }).code, "SESSION_EXPIRED", action);
    assert.equal(g.call({ action, session: "made-up" }).code, "SESSION_EXPIRED", action);
  }
});

/* ── 미션 ── */

test("미션 목록: 사용 중인 미션과 내 완료 여부, 포인트", () => {
  const r = g.call({ action: "missions", session: kim });
  assert.equal(r.ok, true);
  assert.deepEqual(r.missions.map((m) => [m.id, m.method, m.done]), [
    ["portfolio", "링크", false], ["resume", "사진", false], ["essay", "글", false],
  ]);
  assert.deepEqual(r.points, { earned: 0, spent: 0, balance: 0 });
  assert.equal(r.missionPoints, 20);
});

test("링크 인증: 시트에 적고 포인트 +20, 같은 미션은 한 번만", () => {
  const r = g.call({ action: "submitProof", session: kim, missionId: "portfolio", content: " https://kim.github.io " });
  assert.equal(r.ok, true);
  assert.equal(r.points.balance, 20);
  const row = g.sheet("미션인증").data.at(-1);
  assert.deepEqual(row.slice(0, 6), ["2026-2", "kim@gmail.com", "portfolio", "링크", "https://kim.github.io", ""]);

  assert.equal(g.call({ action: "submitProof", session: kim, missionId: "portfolio", content: "https://x.y" }).code, "ALREADY_DONE");
  const list = g.call({ action: "missions", session: kim });
  assert.equal(list.missions.find((m) => m.id === "portfolio").done, true);
  // 다른 학생은 따로
  assert.equal(g.call({ action: "missions", session: lee }).missions.find((m) => m.id === "portfolio").done, false);
});

test("잘못된 인증은 거절하고 포인트를 주지 않는다", () => {
  assert.equal(g.call({ action: "submitProof", session: kim, missionId: "portfolio", content: "javascript:alert(1)" }).code, "BAD_LINK");
  assert.equal(g.call({ action: "submitProof", session: kim, missionId: "essay", content: "  " }).code, "EMPTY_PROOF");
  assert.equal(g.call({ action: "submitProof", session: kim, missionId: "resume", content: "https://a.b/c.jpg" }).code, "BAD_PHOTO");
  assert.equal(g.call({ action: "submitProof", session: kim, missionId: "nope", content: "x" }).code, "NO_MISSION");
  assert.equal(g.call({ action: "submitProof", session: kim, missionId: "off", content: "x" }).code, "NO_MISSION");
  assert.equal(g.sheet("미션인증").data.length, 1); // 제목 줄만
  assert.ok(g.call({ action: "submitProof", session: kim, missionId: "nope", content: "x" }).message);
});

test("사진 인증: 드라이브 폴더에 저장하고 시트에는 파일 ID만 적는다", () => {
  const r = g.call({ action: "submitProof", session: kim, missionId: "resume", content: PHOTO });
  assert.equal(r.ok, true);
  const row = g.sheet("미션인증").data.at(-1);
  assert.equal(row[3], "사진");
  assert.equal(row[4], "");
  const fileId = row[5];
  assert.ok(g.drive.files[fileId]);
  assert.equal(g.drive.files[fileId].type, "image/jpeg");
  assert.equal(Buffer.from(g.drive.files[fileId].bytes).toString(), "가짜 사진 바이트");

  // 두 번째 사진은 같은 폴더에 (폴더를 새로 만들지 않는다)
  g.call({ action: "submitProof", session: lee, missionId: "resume", content: PHOTO });
  assert.equal(Object.keys(g.drive.folders).length, 1);
});

test("학기가 바뀌면 미션을 다시 할 수 있다", () => {
  g.call({ action: "submitProof", session: kim, missionId: "essay", content: "1학기 소감" });
  g.setSetting("학기", "2027-1");
  const r = g.call({ action: "missions", session: kim });
  assert.equal(r.missions.find((m) => m.id === "essay").done, false);
  assert.equal(r.points.balance, 0);
});

/* ── 갤러리 ── */

test("갤러리: 이번 학기 반 전체 인증을 최신순으로, 이름과 미션 이름을 붙여 보여 준다", () => {
  g.call({ action: "submitProof", session: kim, missionId: "essay", content: "잘했다" });
  g.call({ action: "submitProof", session: lee, missionId: "resume", content: PHOTO });
  const r = g.call({ action: "gallery", session: kim });
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].name, "이학생");
  assert.equal(r.items[0].missionName, "이력서 첫 버전 완성");
  assert.equal(r.items[0].kind, "사진");
  assert.ok(r.items[0].fileId);
  assert.equal(r.items[1].content, "잘했다");
  assert.equal(r.items[1].mine, true);
  assert.equal(r.items[0].mine, false);
  // 이메일은 내보내지 않는다
  assert.ok(!JSON.stringify(r).includes("@gmail.com"));
});

test("인증 사진은 로그인한 학생에게만, 인증 기록에 있는 파일만 보여 준다", () => {
  g.call({ action: "submitProof", session: lee, missionId: "resume", content: PHOTO });
  const fileId = g.sheet("미션인증").data.at(-1)[5];
  const r = g.call({ action: "proofImage", session: kim, fileId });
  assert.equal(r.ok, true);
  assert.equal(r.dataUrl, PHOTO);
  // 기록에 없는 파일 ID(선생님 드라이브의 다른 파일)는 열지 않는다
  g.drive.files["secret"] = { bytes: [1], type: "image/png" };
  assert.equal(g.call({ action: "proofImage", session: kim, fileId: "secret" }).code, "NOT_FOUND");
  assert.equal(g.call({ action: "proofImage", session: kim, fileId: "" }).code, "NOT_FOUND");
});

/* ── 보석 ── */

const earn = (session, n) => {
  const ids = ["portfolio", "essay", "resume"];
  const content = { portfolio: "https://a.b", essay: "글", resume: PHOTO };
  for (let i = 0; i < n; i++) g.call({ action: "submitProof", session, missionId: ids[i], content: content[ids[i]] });
};

test("보석 정보: 확률, 뽑기 비용, 내 포인트, 내 보석함", () => {
  const r = g.call({ action: "gems", session: kim });
  assert.equal(r.ok, true);
  assert.equal(r.cost, 30);
  assert.equal(r.ready, true);
  assert.equal(r.odds.length, 5);
  assert.deepEqual(r.points, { earned: 0, spent: 0, balance: 0 });
  assert.equal(r.summary.score, 0);
});

test("포인트가 모자라면 뽑을 수 없다", () => {
  earn(kim, 1); // 20점 < 30
  const r = g.call({ action: "draw", session: kim });
  assert.equal(r.code, "NOT_ENOUGH_POINTS");
  assert.equal(g.sheet("보석뽑기").data.length, 1);
});

test("뽑기: 서버가 확률로 보석을 고르고 포인트를 쓴다", () => {
  earn(kim, 2); // 40점
  g.ctx.random_ = () => 0.97; // 검은색 구간
  const r = g.call({ action: "draw", session: kim });
  assert.equal(r.ok, true);
  assert.equal(r.gem.key, "검은색");
  assert.equal(r.gem.score, 5);
  assert.deepEqual(r.points, { earned: 40, spent: 30, balance: 10 });
  assert.equal(r.summary.counts.검은색, 1);
  assert.deepEqual(g.sheet("보석뽑기").data.at(-1).slice(0, 5), ["2026-2", "kim@gmail.com", "검은색", 5, 30]);
  // 남은 10점으로는 더 못 뽑는다
  assert.equal(g.call({ action: "draw", session: kim }).code, "NOT_ENOUGH_POINTS");
});

test("화면이 보낸 보석·비용은 무시한다 (조작 방지)", () => {
  earn(kim, 2);
  g.ctx.random_ = () => 0;
  const r = g.call({ action: "draw", session: kim, gem: "검은색", cost: 0 });
  assert.equal(r.gem.key, "투명");
  assert.equal(r.points.spent, 30);
});

test("확률 설정의 합이 100이 아니면 뽑기를 막고 이유를 알린다", () => {
  earn(kim, 2);
  g.setSetting("확률 투명", 99);
  assert.equal(g.call({ action: "gems", session: kim }).ready, false);
  const r = g.call({ action: "draw", session: kim });
  assert.equal(r.code, "GEMS_NOT_READY");
  assert.equal(g.sheet("보석뽑기").data.length, 1);
});
