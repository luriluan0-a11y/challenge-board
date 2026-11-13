// 챌린지보드 계산 함수 모음. 화면(DOM)과 저장소에 의존하지 않는 순수 함수만 둔다.

const pad = (n) => String(n).padStart(2, "0");

/** 날짜·시각을 기록용 날짜 키(YYYY-MM-DD)로 바꾼다. dayStartHour 전 시각은 전날로 센다. */
export function dayKey(date, dayStartHour = 4) {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() - dayStartHour);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
