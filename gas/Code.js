/**
 * 챌린지보드 서버 (구글 앱스 스크립트 웹 앱)
 *
 * 붙여 넣는 곳: 구글 시트 → 확장 프로그램 → Apps Script
 *   - 이 파일 → "Code.gs"
 *   - gas/Auth.js → 새 스크립트 파일 "Auth.gs"
 * 처음 한 번: 시트 메뉴 "챌린지보드 → 처음 설정" (또는 편집기에서 setupSheets 실행)
 *
 * 계산(명단 대조, 토큰 확인, 세션 만료)은 Auth.gs에 있고 Node 테스트로 검사한다.
 * 이 파일은 시트 읽기·쓰기와 요청 처리만 한다.
 */

const SHEETS = {
  roster: {
    name: "학생명단",
    header: ["이메일", "이름", "이름확인", "메모"],
    sample: [["student@example.com", "홍길동", "", "예시 줄이에요. 지우고 학생 이메일과 이름을 적어 주세요"]],
  },
  daily: {
    name: "매일챌린지",
    header: ["ID", "이름", "이모지", "사용"],
    sample: [
      ["exercise", "운동 30분", "🏃", "Y"],
      ["study", "스터디 1시간", "📚", "Y"],
      ["apply", "지원서 쓰기", "📮", "Y"],
      ["code-ai", "코드·AI 공부", "💻", "Y"],
    ],
  },
  missions: {
    name: "미션",
    header: ["ID", "이름", "설명", "인증방법", "사용"],
    sample: [
      ["portfolio", "포트폴리오 사이트 만들기", "GitHub Pages로 내 소개 페이지를 올리고 주소로 인증해요", "링크", "Y"],
      ["resume", "이력서 첫 버전 완성", "이력서 화면을 찍어 인증해요 (개인정보는 가리기)", "사진", "Y"],
    ],
  },
  settings: {
    name: "설정",
    header: ["항목", "값", "설명"],
    sample: [
      ["학기", "2026-2", "바꾸면 새 학기로 시작해요. 지난 기록은 시트에 남아요"],
      ["로그인 클라이언트 ID", "", "구글 클라우드에서 만든 OAuth 클라이언트 ID (비밀 정보 아님)"],
      ["매일 체크 포인트", 10, ""],
      ["모두 체크 보너스", 30, ""],
      ["미션 인증 포인트", 20, ""],
      ["보석 뽑기 비용", 30, "테스트하며 정해요"],
      ["확률 투명", 40, "% (다섯 개 합이 100)"],
      ["확률 흰색", 28, "%"],
      ["확률 핑크", 18, "%"],
      ["확률 골드", 10, "%"],
      ["확률 검은색", 4, "%"],
      ["세션 유지 일수", 14, "한 번 로그인하면 며칠 동안 다시 로그인하지 않아도 되는지"],
    ],
  },
  sessions: { name: "세션", header: ["토큰해시", "이메일", "만료(ms)", "만든시각"], hidden: true },
  checks: { name: "체크기록", header: ["학기", "날짜", "이메일", "챌린지ID", "시각"] },
  proofs: { name: "미션인증", header: ["학기", "이메일", "미션ID", "종류", "내용", "파일ID", "시각"] },
  draws: { name: "보석뽑기", header: ["학기", "이메일", "보석", "점수", "사용포인트", "시각"] },
};

const MESSAGES = {
  NOT_REGISTERED: "등록되지 않은 계정이에요. 선생님께 이 이메일을 알려 주세요.",
  NEED_NAME: "처음 로그인이에요. 선생님께 알려 드린 이름을 입력해 주세요.",
  NAME_MISMATCH: "이름이 명단과 달라요. 선생님께 등록한 이름을 확인해 주세요.",
  INVALID_TOKEN: "구글 로그인을 확인하지 못했어요. 다시 로그인해 주세요.",
  SERVER_NOT_CONFIGURED: "선생님이 아직 로그인 설정을 마치지 않았어요.",
  SESSION_EXPIRED: "로그인 시간이 끝났어요. 다시 로그인해 주세요.",
  BAD_REQUEST: "요청을 이해하지 못했어요.",
  SERVER_ERROR: "서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
};

/* ───────── 시트 메뉴와 처음 설정 ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("챌린지보드").addItem("처음 설정", "setupSheets").addToUi();
}

/** 필요한 탭을 만들고 제목 줄과 예시를 넣는다. 이미 있는 탭과 내용은 건드리지 않는다. */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const made = [];
  Object.keys(SHEETS).forEach((key) => {
    const def = SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (!sh) {
      sh = ss.insertSheet(def.name);
      made.push(def.name);
    }
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, def.header.length).setValues([def.header]).setFontWeight("bold").setBackground("#e8f3ff");
      sh.setFrozenRows(1);
      if (def.sample) sh.getRange(2, 1, def.sample.length, def.header.length).setValues(def.sample);
      sh.autoResizeColumns(1, def.header.length);
    }
    if (def.hidden) sh.hideSheet();
  });
  // 처음 있던 빈 탭("시트1" 등)은 우리 탭이 아니고 비어 있으면 지운다.
  const ours = Object.keys(SHEETS).map((k) => SHEETS[k].name);
  ss.getSheets().forEach((sh) => {
    if (ours.indexOf(sh.getName()) === -1 && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEETS.roster.name));
  const msg = made.length ? `만든 탭: ${made.join(", ")}` : "이미 모든 탭이 있어요.";
  try { SpreadsheetApp.getUi().alert(`${msg}\n\n다음: "학생명단"에 학생을, "설정"에 로그인 클라이언트 ID를 적어 주세요.`); } catch (e) { Logger.log(msg); }
}

/* ───────── 웹 앱 입구 ───────── */

/** 주소가 살아 있는지 확인용. */
function doGet() {
  return json_({ ok: true, service: "challenge-board" });
}

/** 화면에서 보내는 요청. 본문은 JSON 글자(text/plain)로 받는다. */
function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return fail_("BAD_REQUEST");
  }
  try {
    switch (req.action) {
      case "login": return json_(login_(req));
      case "me": return json_(me_(req));
      case "logout": return json_(logout_(req));
      default: return fail_("BAD_REQUEST");
    }
  } catch (err) {
    console.error(err);
    return fail_("SERVER_ERROR");
  }
}

/* ───────── 로그인 ───────── */

function login_(req) {
  const settings = readSettings_();
  const clientId = String(settings["로그인 클라이언트 ID"] || "").trim();
  if (!clientId) return failObj_("SERVER_NOT_CONFIGURED");

  const claims = fetchTokenInfo_(req.idToken);
  if (!claims) return failObj_("INVALID_TOKEN");
  const tokenError = checkTokenClaims(claims, clientId, Math.floor(Date.now() / 1000));
  if (tokenError) return failObj_(tokenError === "SERVER_NOT_CONFIGURED" ? tokenError : "INVALID_TOKEN");

  const rosterSheet = sheet_(SHEETS.roster.name);
  const student = findStudent(rosterRows_(rosterSheet), claims.email);
  const decision = decideLogin(student, req.name);
  if (decision.code !== "OK") {
    const out = failObj_(decision.code);
    if (decision.code === "NOT_REGISTERED") out.email = normalizeEmail(claims.email);
    return out;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (decision.markVerified) {
      rosterSheet.getRange(student.row + 2, 3).setValue(Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm"));
    }
    const days = Number(settings["세션 유지 일수"]) || 14;
    const token = Utilities.getUuid() + Utilities.getUuid();
    const now = Date.now();
    const sessions = sheet_(SHEETS.sessions.name);
    removeExpiredSessions_(sessions, now);
    sessions.appendRow([sha256_(token), student.email, sessionExpiry(now, days), new Date(now)]);
    return { ok: true, session: token, student: { name: student.name, email: student.email }, semester: String(settings["학기"] || "") };
  } finally {
    lock.releaseLock();
  }
}

/** 저장해 둔 세션으로 "나는 누구인가"를 확인한다. 명단에서 빠진 학생은 거절한다. */
function me_(req) {
  const student = studentFromSession_(req.session);
  if (!student) return failObj_("SESSION_EXPIRED");
  return { ok: true, student: { name: student.name, email: student.email }, semester: String(readSettings_()["학기"] || "") };
}

function logout_(req) {
  if (!req.session) return { ok: true };
  const sessions = sheet_(SHEETS.sessions.name);
  const hash = sha256_(String(req.session));
  const values = sessions.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === hash) sessions.deleteRow(i + 1);
  }
  return { ok: true };
}

/** 다른 기능(체크, 인증, 뽑기)에서도 쓰는 공통 확인. 유효하면 학생, 아니면 null. */
function studentFromSession_(token) {
  if (!token) return null;
  const hash = sha256_(String(token));
  const values = sheet_(SHEETS.sessions.name).getDataRange().getValues();
  const now = Date.now();
  for (let i = 1; i < values.length; i++) {
    const [h, email, expires] = values[i];
    if (h === hash && isSessionValid(expires, now)) {
      return findStudent(rosterRows_(sheet_(SHEETS.roster.name)), email);
    }
  }
  return null;
}

/* ───────── 도우미 ───────── */

function fetchTokenInfo_(idToken) {
  if (!idToken) return null;
  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  try { return JSON.parse(res.getContentText()); } catch (e) { return null; }
}

function rosterRows_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 3).getValues();
}

function readSettings_() {
  const sh = sheet_(SHEETS.settings.name);
  const out = {};
  const last = sh.getLastRow();
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(([k, v]) => { if (k) out[String(k).trim()] = v; });
  return out;
}

function removeExpiredSessions_(sh, now) {
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (!isSessionValid(values[i][2], now)) sh.deleteRow(i + 1);
  }
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error(`"${name}" 탭이 없어요. 시트 메뉴에서 "챌린지보드 → 처음 설정"을 실행해 주세요.`);
  return sh;
}

function sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function failObj_(code) {
  return { ok: false, code: code, message: MESSAGES[code] || MESSAGES.SERVER_ERROR };
}

function fail_(code) {
  return json_(failObj_(code));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
