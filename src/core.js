// 챌린지보드 계산 함수 모음. 화면(DOM)과 저장소에 의존하지 않는 순수 함수만 둔다.

const pad = (n) => String(n).padStart(2, "0");

const DEFAULT_ITEMS = [
  ["morning-vitamin", "💊", "아침 영양제"],
  ["walk", "🚶", "산책 30분"],
  ["speak", "🗣️", "스픽"],
  ["duolingo", "🦉", "듀오링고"],
  ["computer-cert", "📊", "컴퓨터활용능력"],
  ["thecamp", "✉️", "더캠프"],
  ["evening-vitamin", "💊", "저녁 영양제"],
  ["apply", "📮", "지원 건수", "count"],
  ["code-ai", "💻", "코드·AI 공부"],
];

const DEFAULT_REWARDS = [
  ["latte", "☕", "라떼 한 잔", 100],
  ["game", "🎮", "게임 1시간", 150],
  ["dessert", "🍰", "디저트", 200],
];

const DEFAULT_MISSIONS = [
  ["command-practice", "명령어 입력 연습 7개"],
  ["programming", "프로그래밍 공부"],
];

/** 보드를 처음 열었을 때의 상태. startDay(YYYY-MM-DD)부터 기록을 센다. */
export function createInitialState(startDay) {
  return {
    version: 1,
    startDay,
    settings: {
      dayStartHour: 4,
      points: { check: 10, allBonus: 30, missionLog: 20, memo: 5, badge: 50 },
    },
    items: DEFAULT_ITEMS.map(([id, emoji, name, kind = "check"]) => ({ id, emoji, name, kind, since: startDay, hiddenFrom: null })),
    days: {},
    missions: DEFAULT_MISSIONS.map(([id, name]) => ({ id, name, since: startDay, archived: false, logs: [] })),
    rewards: DEFAULT_REWARDS.map(([id, emoji, name, cost]) => ({ id, emoji, name, cost })),
    purchases: [],
  };
}

/** 그날 셀 매일 항목: 시작한 날 이후이고, 숨기기 전인 항목 (화면 순서대로). */
export function activeItems(state, day) {
  return state.items.filter((i) => i.since <= day && (!i.hiddenFrom || day < i.hiddenFrom));
}

/** 그날의 달성률: 체크한 항목 수 / 그날 셀 항목 수. */
export function completion(state, day) {
  const items = activeItems(state, day);
  const checks = state.days[day]?.checks ?? {};
  const done = items.filter((i) => checks[i.id]).length;
  return { done, total: items.length, rate: items.length ? done / items.length : 0 };
}

const emptyDay = () => ({ checks: {}, counts: {}, memo: "" });

/** state를 복사하고, 그날 기록을 고칠 수 있게 꺼내 준다. */
function editDay(state, day) {
  const next = structuredClone(state);
  next.days[day] = { ...emptyDay(), ...next.days[day] };
  return [next, next.days[day]];
}

/** 매일 항목 체크를 켜고 끈다. 건수 항목은 켜면 1건, 끄면 건수도 지운다. */
export function toggleCheck(state, day, itemId) {
  const [next, rec] = editDay(state, day);
  const item = next.items.find((i) => i.id === itemId);
  if (rec.checks[itemId]) {
    delete rec.checks[itemId];
    delete rec.counts[itemId];
  } else {
    rec.checks[itemId] = true;
    if (item?.kind === "count") rec.counts[itemId] = 1;
  }
  return next;
}

/** 건수 항목의 건수를 바꾼다. 1 이상이면 체크도 켜고, 0 이하면 체크를 끈다. */
export function setCount(state, day, itemId, n) {
  const [next, rec] = editDay(state, day);
  const count = Math.floor(Number(n));
  if (count >= 1) {
    rec.checks[itemId] = true;
    rec.counts[itemId] = count;
  } else {
    delete rec.checks[itemId];
    delete rec.counts[itemId];
  }
  return next;
}

/** 그날의 한 줄 메모를 저장한다. */
export function setMemo(state, day, text) {
  const [next, rec] = editDay(state, day);
  rec.memo = String(text);
  return next;
}

/** 그날 받은 포인트: 체크 + 100% 보너스 + 메모 + 미션 기록(미션마다 하루 한 번). */
export function dayPoints(state, day) {
  const p = state.settings.points;
  const { done, total } = completion(state, day);
  const memo = (state.days[day]?.memo ?? "").trim() ? p.memo : 0;
  const missions = state.missions.filter((m) => m.logs.some((l) => l.day === day)).length;
  return done * p.check + (total > 0 && done === total ? p.allBonus : 0) + memo + missions * p.missionLog;
}

/** 지금까지 모은 포인트: 기록이 있는 모든 날의 dayPoints 합. */
export function earnedPoints(state) {
  const days = new Set(Object.keys(state.days));
  for (const m of state.missions) for (const l of m.logs) days.add(l.day);
  let sum = 0;
  for (const d of days) sum += dayPoints(state, d);
  return sum;
}

/** 날짜·시각을 기록용 날짜 키(YYYY-MM-DD)로 바꾼다. dayStartHour 전 시각은 전날로 센다. */
export function dayKey(date, dayStartHour = 4) {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() - dayStartHour);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
