// 화면 연결. 계산은 core.js, 저장은 storage.js에 맡기고 여기서는 그리기와 클릭 처리만 한다.
import { dayKey, activeItems, completion, toggleCheck, setCount, setMemo, dayPoints, earnedPoints } from "./core.js";
import { loadState, saveState, STORAGE_KEY } from "./storage.js";
import { callApi, loadSession, saveSession, clearSession, loginStep } from "./auth.js";
import { API_URL, GOOGLE_CLIENT_ID } from "./config.js";
import { fitSize, gemSlots, drawState, proofForm } from "./game.js";

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
  if (name === "missions") loadMissions();
  if (name === "rewards") loadGems();
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

/* ───────── 서버 요청 (로그인한 학생) ───────── */
// 세션을 붙여 보낸다. 세션이 끝났으면 로그인 화면으로 돌아간다.
async function authed(body) {
  const res = await api({ ...body, session: loadSession(storage) });
  if (!res.ok && res.code === "SESSION_EXPIRED") {
    clearSession(storage);
    document.body.classList.add("locked");
    showPane("login", res.message);
  }
  return res;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setMsg(id, text, ok = false) {
  const m = $(id);
  m.textContent = text || "";
  m.classList.toggle("ok", ok);
}

/* ───────── 미션 탭 ───────── */
let missionsBusy = false;

async function loadMissions() {
  if (missionsBusy) return;
  missionsBusy = true;
  try {
    const [m, g] = await Promise.all([authed({ action: "missions" }), authed({ action: "gallery" })]);
    if (!m.ok) { setMsg("missionMsg", m.message); return; }
    $("mPoints").textContent = m.points.balance;
    $("mEach").textContent = `+${m.missionPoints}`;
    const done = m.missions.filter((x) => x.done).length;
    $("mCount").textContent = `${done} / ${m.missions.length} 완료`;
    renderMissions(m.missions);
    if (g.ok) renderGallery(g.items);
    else setMsg("missionMsg", g.message);
  } finally {
    missionsBusy = false;
  }
}

function renderMissions(list) {
  const box = $("missions");
  box.replaceChildren();
  if (!list.length) { box.appendChild(el("li", "empty-card", "아직 선생님이 등록한 미션이 없어요.")); return; }
  for (const m of list) {
    const li = el("li", m.done ? "mission done" : "mission");
    const head = el("div", "mission-head");
    head.append(el("h3", "", m.name), el("span", "method", m.method));
    li.appendChild(head);
    if (m.desc) li.appendChild(el("p", "", m.desc));
    if (m.done) {
      li.appendChild(el("span", "done-tag", "✓ 인증 완료"));
    } else {
      const open = el("button", "gold-btn open-btn", "인증하기");
      open.type = "button";
      open.addEventListener("click", () => { open.remove(); li.appendChild(buildProofForm(m)); });
      li.appendChild(open);
    }
    box.appendChild(li);
  }
}

function buildProofForm(mission) {
  const spec = proofForm(mission.method);
  const form = el("form", "proof-form");
  form.appendChild(el("p", "hint", spec.hint));
  const msg = el("p", "msg");
  msg.setAttribute("role", "alert");
  let input;
  let photoData = "";
  if (spec.input === "file") {
    input = el("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/*";
    const preview = el("img", "preview");
    preview.alt = "올릴 사진 미리 보기";
    preview.hidden = true;
    input.addEventListener("change", async () => {
      photoData = "";
      preview.hidden = true;
      msg.textContent = "";
      const file = input.files?.[0];
      if (!file) return;
      try {
        photoData = await shrinkPhoto(file);
        preview.src = photoData;
        preview.hidden = false;
      } catch { msg.textContent = "사진을 읽지 못했어요. 다른 사진을 골라 주세요."; }
    });
    form.append(input, preview);
  } else if (spec.input === "url") {
    input = el("input", "memo");
    input.type = "url";
    input.placeholder = "https://";
    form.appendChild(input);
  } else {
    input = el("textarea", "memo");
    input.maxLength = 1000;
    form.appendChild(input);
  }
  input.setAttribute("aria-label", `${mission.name} 인증`);

  const row = el("div", "row");
  const submit = el("button", "gold-btn", "올리기");
  submit.type = "submit";
  row.appendChild(submit);
  form.append(row, msg);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    const content = spec.input === "file" ? photoData : input.value.trim();
    if (!content) { msg.textContent = spec.input === "file" ? "사진을 골라 주세요." : "내용을 넣어 주세요."; return; }
    submit.disabled = true;
    submit.textContent = "올리는 중…";
    const res = await authed({ action: "submitProof", missionId: mission.id, content });
    if (res.ok) {
      setMsg("missionMsg", `"${mission.name}" 인증 완료! 내 포인트 ${res.points.balance}`, true);
      loadMissions();
    } else {
      msg.textContent = res.message;
      submit.disabled = false;
      submit.textContent = "올리기";
    }
  });
  setTimeout(() => input.focus(), 0);
  return form;
}

/** 사진을 긴 쪽 1280px JPEG로 줄인다. 보내는 크기가 줄고, 사진 속 위치정보 같은 메타데이터도 빠진다. */
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, 1280);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const photoCache = new Map();

function renderGallery(items) {
  const box = $("gallery");
  box.replaceChildren();
  if (!items.length) { box.appendChild(el("div", "empty-card", "아직 올라온 인증이 없어요. 첫 번째로 인증해 보세요!")); return; }
  const photos = [];
  for (const it of items) {
    const card = el("article", it.mine ? "g-card mine" : "g-card");
    if (it.kind === "사진" && it.fileId) {
      const ph = el("div", "g-photo", "사진 불러오는 중…");
      card.appendChild(ph);
      photos.push({ ph, fileId: it.fileId, alt: `${it.name}의 ${it.missionName} 인증 사진` });
    }
    const body = el("div", "g-body");
    body.append(el("span", "who", it.mine ? `${it.name} (나)` : it.name), el("span", "what", it.missionName));
    if (it.kind === "링크" && /^https?:\/\//i.test(it.content)) {
      const a = el("a", "", it.content);
      a.href = it.content;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      body.appendChild(a);
    } else if (it.content) {
      body.appendChild(el("p", "text", it.content));
    }
    if (it.time) body.appendChild(el("time", "", it.time));
    card.appendChild(body);
    box.appendChild(card);
  }
  loadPhotos(photos);
}

/** 갤러리 사진을 세 장씩 차례로 불러온다 (사진마다 서버 요청이 하나씩 든다). */
async function loadPhotos(list) {
  const queue = [...list];
  const worker = async () => {
    while (queue.length) {
      const { ph, fileId, alt } = queue.shift();
      let src = photoCache.get(fileId);
      if (!src) {
        const res = await authed({ action: "proofImage", fileId });
        if (!res.ok) { ph.textContent = "사진을 불러오지 못했어요"; continue; }
        src = res.dataUrl;
        photoCache.set(fileId, src);
      }
      const img = el("img");
      img.alt = alt;
      img.src = src;
      ph.replaceChildren(img);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

/* ───────── 보석 탭 ───────── */
let gemInfo = null;

async function loadGems() {
  setMsg("gemMsg", "");
  const res = await authed({ action: "gems" });
  if (!res.ok) { setMsg("gemMsg", res.message); return; }
  gemInfo = res;
  renderGems();
}

function renderGems() {
  const { points, cost, ready, odds, summary } = gemInfo;
  $("gPoints").textContent = points.balance;
  const st = drawState(points, cost, ready);
  const btn = $("drawBtn");
  btn.disabled = !st.enabled;
  btn.textContent = st.label;
  $("gemScore").textContent = `${summary.kinds} / 5종류 · ${summary.score}점`;
  $("completeBadge").hidden = !summary.complete;

  const shelf = $("gemShelf");
  shelf.replaceChildren();
  for (const s of gemSlots(odds, summary)) {
    const li = el("li", s.owned ? "gem-slot owned" : "gem-slot");
    li.append(el("span", "emo", s.emoji), el("span", "nm", s.name), el("span", "cnt", `${s.count}개`), el("span", "meta", `${s.score}점 · 확률 ${s.pct}%`));
    shelf.appendChild(li);
  }
}

$("drawBtn").addEventListener("click", async () => {
  const btn = $("drawBtn");
  btn.disabled = true;
  btn.textContent = "뽑는 중…";
  setMsg("gemMsg", "");
  const reveal = $("gemReveal");
  reveal.classList.remove("pop");
  reveal.classList.add("shake");
  $("revealEmo").textContent = "🎁";
  $("revealTxt").textContent = "두근두근…";
  const [res] = await Promise.all([authed({ action: "draw" }), new Promise((r) => setTimeout(r, 700))]);
  reveal.classList.remove("shake");
  if (!res.ok) {
    $("revealTxt").textContent = "포인트로 보석을 뽑아 보세요";
    setMsg("gemMsg", res.message);
    if (gemInfo) renderGems();
    return;
  }
  void reveal.offsetWidth; // 애니메이션을 처음부터 다시
  reveal.classList.add("pop");
  $("revealEmo").textContent = res.gem.emoji;
  $("revealTxt").textContent = `${res.gem.name}! (+${res.gem.score}점)`;
  gemInfo = { ...gemInfo, points: res.points, summary: res.summary };
  renderGems();
});
