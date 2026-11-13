// 로그인 계산: 서버(앱스 스크립트) 요청, 세션 저장, 서버 답 → 보여 줄 화면.
// fetch와 저장소를 인자로 받아서 테스트에서는 가짜를 쓴다.

export const SESSION_KEY = "challenge-board/session";

const MESSAGES = {
  NETWORK: "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
  SERVER_ERROR: "서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
};

/** 앱스 스크립트 웹 앱에 요청한다. 실패해도 멈추지 않고 { ok:false, code, message }를 돌려준다. */
export async function callApi(fetchFn, url, body) {
  let res;
  try {
    res = await fetchFn(url, {
      method: "POST",
      // application/json이면 브라우저가 사전 확인(preflight)을 보내는데, 앱스 스크립트는 그 요청을 받지 못한다.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "NETWORK", message: MESSAGES.NETWORK };
  }
  if (!res.ok) return { ok: false, code: "SERVER_ERROR", message: MESSAGES.SERVER_ERROR };
  try {
    return await res.json();
  } catch {
    return { ok: false, code: "SERVER_ERROR", message: MESSAGES.SERVER_ERROR };
  }
}

export function loadSession(storage) {
  try { return storage?.getItem(SESSION_KEY) || null; } catch { return null; }
}

export function saveSession(storage, token) {
  try { storage.setItem(SESSION_KEY, token); return true; } catch { return false; }
}

export function clearSession(storage) {
  try { storage?.removeItem(SESSION_KEY); } catch { /* 지울 수 없어도 계속한다 */ }
}

/** 서버의 login/me 답을 보고 다음에 보여 줄 화면을 고른다: "board" | "name" | "login" */
export function loginStep(res) {
  if (res?.ok) return { screen: "board", session: res.session, student: res.student, semester: res.semester };
  const message = res?.message || MESSAGES.SERVER_ERROR;
  switch (res?.code) {
    case "NEED_NAME":
    case "NAME_MISMATCH":
      return { screen: "name", message };
    case "NOT_REGISTERED":
      return { screen: "login", message: res.email ? `${message} (${res.email})` : message };
    default:
      return { screen: "login", message };
  }
}
