/**
 * 로그인·명단 확인 계산 (앱스 스크립트용).
 * 시트나 인터넷에 접근하지 않는 순수 함수만 둔다. Node 테스트(tests/gas-auth.test.js)로 검사한다.
 */

/** 이메일 비교용: 앞뒤 공백 제거, 소문자. */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** 이름 비교용: 모든 띄어쓰기를 지운다. */
function normalizeName(name) {
  return String(name || "").normalize("NFC").replace(/\s+/g, "");
}

/**
 * 학생명단(2차원 배열: [이메일, 이름, 이름확인])에서 이메일로 학생을 찾는다.
 * 찾으면 { row(0부터), email, name, nameVerified }, 없으면 null.
 */
function findStudent(rows, email) {
  const target = normalizeEmail(email);
  if (!target) return null;
  for (let i = 0; i < rows.length; i++) {
    const [rowEmail, name, verified] = rows[i];
    if (normalizeEmail(rowEmail) === target) {
      return { row: i, email: target, name: String(name || "").trim(), nameVerified: Boolean(String(verified || "").trim()) };
    }
  }
  return null;
}

/**
 * 구글 로그인 토큰의 내용(tokeninfo 결과)을 확인한다.
 * 문제가 없으면 null, 있으면 오류 코드를 돌려준다.
 */
function checkTokenClaims(claims, clientId, nowSec) {
  if (!clientId) return "SERVER_NOT_CONFIGURED";
  if (!claims || claims.aud !== clientId) return "WRONG_AUDIENCE";
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return "WRONG_ISSUER";
  if (String(claims.email_verified) !== "true") return "EMAIL_NOT_VERIFIED";
  if (!(Number(claims.exp) > nowSec)) return "TOKEN_EXPIRED";
  return null;
}

/**
 * 로그인 판정. student는 findStudent 결과(없으면 null), nameInput은 학생이 입력한 이름.
 * markVerified가 true면 명단의 "이름확인" 칸에 오늘 날짜를 적는다.
 */
function decideLogin(student, nameInput) {
  if (!student) return { code: "NOT_REGISTERED", markVerified: false };
  if (student.nameVerified) return { code: "OK", markVerified: false };
  const typed = normalizeName(nameInput);
  if (!typed) return { code: "NEED_NAME", markVerified: false };
  if (typed !== normalizeName(student.name)) return { code: "NAME_MISMATCH", markVerified: false };
  return { code: "OK", markVerified: true };
}

/** 세션이 끝나는 시각(밀리초). */
function sessionExpiry(nowMs, days) {
  return nowMs + days * 24 * 60 * 60 * 1000;
}

/** 세션이 아직 유효한가. */
function isSessionValid(expiresMs, nowMs) {
  const exp = Number(expiresMs);
  return Boolean(expiresMs) && exp > nowMs;
}
