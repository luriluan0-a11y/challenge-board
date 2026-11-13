// 화면 연결. 계산은 core.js, 저장은 storage.js에 맡기고 여기서는 그리기와 클릭 처리만 한다.
import { dayKey, activeItems, completion, toggleCheck, setCount, setMemo, dayPoints, earnedPoints } from "./core.js";
import { loadState, saveState, STORAGE_KEY } from "./storage.js";
import { callApi, loadSession, saveSession, clearSession, loginStep } from "./auth.js";
import { API_URL, GOOGLE_CLIENT_ID } from "./config.js";

const $ = (id) => document.getElementById(id);
const WEEKDAYS = "일월화수목금토";

let storage;
try { storage = window.localStorage; } catch { storage = null; }
const memoryStore = { data: {}, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); } };

const loaded = loadState(storage ?? memoryStore);
let state = loaded.state;
let canSave = Boolean(storage) && loaded.ok;

if (!loaded.ok) {
  // 읽지 못한 원래 기록을 덮어쓰지 않도록 따로 보관해 둔다.
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) storage.setItem(`${STORAGE_KEY}-broken-${Date.now()}`, raw);
    canSave = Boolean(storage);
  } catch { canSave = false; }
  showBanner(canSave
    ? "저장된 기록을 읽지 못해 새로 시작했어요. 원래 기록은 따로 보관해 두었어요."
    : "이 브라우저에서는 기록을 저장할 수 없어요 (사생활 보호 모드 등). 창을 닫으면 기록이 사라져요.");
} else if (!storage) {
  showBanner("이 브라우저에서는 기록을 저장할 수 없어요. 창을 닫으면 기록이 사라져요.");
}

function showBanner(text) {
  const b = $("banner");
  b.textContent = text;
  b.hidden = false;
}

const today = () => dayKey(new Date(), state.settings.dayStartHour);

function commit(next) {
  const day = today();
  const wasComplete = isComplete(state, day);
  state = next;
  if (canSave && !saveState(storage, state)) {
    canSave = false;
    showBanner("기록을 저장하지 못했어요. 저장 공간이 꽉 찼거나 막혀 있을 수 있어요.");
  }
  render();
  if (!wasComplete && isComplete(state, day)) celebrate();
}

function isComplete(s, day) {
  const c = completion(s, day);
  return c.total > 0 && c.done === c.total;
}

function celebrate() {
  const box = $("celebrate");
  $("bonusPts").textContent = state.settings.points.allBonus;
  box.hidden = false;
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => { box.hidden = true; }, 2200);
}
$("celebrate").addEventListener("click", () => { $("celebrate").hidden = true; });

function render() {
  const day = today();
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  $("dateTitle").textContent = `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${weekday})`;

  const c = completion(state, day);
  const pct = Math.round(c.rate * 100);
  const complete = isComplete(state, day);
  $("pct").textContent = `${pct}%`;
  $("doneText").textContent = `${c.done} / ${c.total}`;
  renderCoins(day);
  $("todayPoints").textContent = `+${dayPoints(state, day)}`;
  const applyItem = activeItems(state, day).find((i) => i.kind === "count");
  const applied = applyItem ? (state.days[day]?.counts?.[applyItem.id] ?? 0) : 0;
  $("applyCount").textContent = `${applied}건`;
  $("nextGoal").textContent = complete ? "오늘의 보물을 모두 찾았어요! 🏴‍☠️" : `금화 ${c.total - c.done}개 남음`;
  $("stamp").hidden = !complete;
  $("stampEmpty").hidden = complete;
  $("stampBox").classList.toggle("done", complete);
  $("itemCount").textContent = `${c.total}개`;
  $("earned").textContent = earnedPoints(state).toLocaleString("ko-KR");

  renderItems(day);

  const memo = $("memo");
  if (document.activeElement !== memo) memo.value = state.days[day]?.memo ?? "";
}

/* 탁자 위 금화: 항목 하나에 금화 하나, 체크하면 금화가 뒤집혀 금색이 된다 */
function renderCoins(day) {
  const checks = state.days[day]?.checks ?? {};
  const box = $("coins");
  box.replaceChildren();
  for (const item of activeItems(state, day)) {
    const c = document.createElement("span");
    c.className = checks[item.id] ? "coin on" : "coin";
    c.textContent = item.emoji;
    c.title = `${item.name}${checks[item.id] ? " (완료)" : ""}`;
    box.appendChild(c);
  }
}

function renderItems(day) {
  const rec = state.days[day] ?? { checks: {}, counts: {} };
  const list = $("items");
  list.replaceChildren();
  for (const item of activeItems(state, day)) {
    const on = Boolean(rec.checks[item.id]);
    const li = document.createElement("li");
    li.className = "item";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "check";
    btn.setAttribute("aria-pressed", String(on));
    btn.innerHTML = '<span class="emo"></span><span class="txt"><span class="name"></span><span class="meta"></span></span><span class="pts"></span><span class="box" aria-hidden="true"></span>';
    btn.querySelector(".emo").textContent = item.emoji;
    btn.querySelector(".name").textContent = item.name;
    btn.querySelector(".meta").textContent = on ? "완료" : (item.kind === "count" ? "체크하면 건수를 적어요" : "체크하기");
    btn.querySelector(".pts").textContent = `+${state.settings.points.check}`;
    btn.querySelector(".box").textContent = on ? "✓" : "";
    btn.addEventListener("click", () => commit(toggleCheck(state, today(), item.id)));
    li.appendChild(btn);

    if (item.kind === "count" && on) {
      const n = rec.counts[item.id] ?? 1;
      const st = document.createElement("div");
      st.className = "stepper";
      st.innerHTML = '<span class="lbl">오늘 지원한 곳</span><button type="button" aria-label="한 건 빼기">−</button><output aria-live="polite"></output><button type="button" aria-label="한 건 더하기">+</button>';
      st.querySelector("output").textContent = `${n}건`;
      const [minus, plus] = st.querySelectorAll("button");
      minus.addEventListener("click", () => commit(setCount(state, today(), item.id, n - 1)));
      plus.addEventListener("click", () => commit(setCount(state, today(), item.id, n + 1)));
      li.appendChild(st);
    }
    list.appendChild(li);
  }
}

/* 메모: 입력을 멈추면 저장 */
const memoInput = $("memo");
let memoTimer;
function saveMemo() {
  clearTimeout(memoTimer);
  const day = today();
  if ((state.days[day]?.memo ?? "") === memoInput.value) return;
  commit(setMemo(state, day, memoInput.value));
  $("memoState").textContent = memoInput.value.trim() ? "저장했어요" : "";
}
memoInput.addEventListener("input", () => {
  $("memoState").textContent = "쓰는 중…";
  clearTimeout(memoTimer);
  memoTimer = setTimeout(saveMemo, 600);
});
memoInput.addEventListener("blur", saveMemo);
memoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { saveMemo(); memoInput.blur(); } });

/* 탭 */
function go(name) {
  document.querySelectorAll(".tab").forEach((t) => { t.hidden = t.dataset.tab !== name; });
  document.querySelectorAll(".tabs button").forEach((b) => {
    if (b.dataset.go === name) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  moveIndicator();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));

/* 현재 탭 아래 파란 막대 */
function moveIndicator() {
  const active = document.querySelector('.tabs button[aria-current="page"]');
  const bar = $("tabIndicator");
  if (!active || !bar) return;
  const nav = active.parentElement.getBoundingClientRect();
  const r = active.getBoundingClientRect();
  bar.style.left = `${r.left - nav.left + r.width / 2 - bar.offsetWidth / 2}px`;
}
window.addEventListener("resize", moveIndicator);

/* 날짜가 바뀌면(새벽 4시) 다시 그린다 */
let shownDay = today();
function checkDayChange() {
  if (today() !== shownDay) { shownDay = today(); render(); }
}
setInterval(checkDayChange, 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDayChange(); });

render();

/* ───────── 로그인 ───────── */
// 확인 중 → (세션이 살아 있으면) 보드 / (아니면) 구글 로그인 → 처음이면 이름 입력 → 보드
const api = (body) => callApi((...a) => fetch(...a), API_URL, body);
let pendingIdToken = null; // 이름을 물을 때 다시 보낼 구글 토큰 (약 1시간 유효)

function showPane(name, message = "") {
  $("paneLoading").hidden = name !== "loading";
  $("paneLogin").hidden = name !== "login";
  $("paneName").hidden = name !== "name";
  if (name === "login") { $("loginMsg").textContent = message; renderGoogleButton(); }
  if (name === "name") {
    if (message) $("nameLead").textContent = message;
    $("nameMsg").textContent = "";
    $("nameInput").focus();
  }
}

function enterBoard(student, semester) {
  $("meName").textContent = student?.name ?? "";
  $("meEmail").textContent = student?.email ?? "";
  $("meSemester").textContent = semester ? `${semester} 학기` : "";
  document.body.classList.remove("locked");
  render();
  moveIndicator();
}

function apply(step, { fromName = false } = {}) {
  if (step.screen === "board") {
    if (step.session) saveSession(storage, step.session);
    pendingIdToken = null;
    enterBoard(step.student, step.semester);
  } else if (step.screen === "name") {
    if (fromName) $("nameMsg").textContent = step.message;
    else showPane("name", step.message);
  } else {
    pendingIdToken = null;
    showPane("login", step.message);
  }
}

async function onGoogleCredential({ credential }) {
  pendingIdToken = credential;
  showPane("loading");
  apply(loginStep(await api({ action: "login", idToken: credential })));
}

$("paneName").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("nameInput").value.trim();
  if (!name || !pendingIdToken) return;
  const btn = $("nameSubmit");
  btn.disabled = true;
  try {
    apply(loginStep(await api({ action: "login", idToken: pendingIdToken, name })), { fromName: true });
  } finally { btn.disabled = false; }
});
$("nameBack").addEventListener("click", () => { pendingIdToken = null; showPane("login"); });

$("logoutBtn").addEventListener("click", async () => {
  const session = loadSession(storage);
  clearSession(storage);
  try { window.google?.accounts.id.disableAutoSelect(); } catch { /* 없어도 된다 */ }
  document.body.classList.add("locked");
  showPane("login", "로그아웃했어요.");
  if (session) api({ action: "logout", session });
});

/* 구글 로그인 버튼: 라이브러리가 늦게 오면 올 때까지 기다린다 */
let googleReady = false;
function renderGoogleButton() {
  const box = $("googleBtn");
  if (!window.google?.accounts?.id) {
    box.textContent = "구글 로그인 버튼을 불러오는 중…";
    clearTimeout(renderGoogleButton.timer);
    renderGoogleButton.timer = setTimeout(renderGoogleButton, 300);
    return;
  }
  if (!googleReady) {
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential, ux_mode: "popup" });
    googleReady = true;
  }
  box.textContent = "";
  window.google.accounts.id.renderButton(box, { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: "ko", width: 260 });
}

async function start() {
  const session = loadSession(storage);
  if (!session) { showPane("login"); return; }
  showPane("loading");
  const res = await api({ action: "me", session });
  if (res.ok) { enterBoard(res.student, res.semester); return; }
  if (res.code === "SESSION_EXPIRED") clearSession(storage);
  showPane("login", res.code === "SESSION_EXPIRED" ? "" : res.message);
}
start();
