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

/** 날짜·시각을 기록용 날짜 키(YYYY-MM-DD)로 바꾼다. dayStartHour 전 시각은 전날로 센다. */
export function dayKey(date, dayStartHour = 4) {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() - dayStartHour);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
