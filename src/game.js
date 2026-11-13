// 미션·보석 화면 계산. 그리기는 app.js, 확률·포인트 판정은 서버(gas/Game.js)가 한다.

/** 사진을 올리기 전에 줄일 크기: 긴 쪽을 max에 맞춘다. 이미 작으면 그대로. */
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** 보석함 칸: 확률표에 내 개수를 붙인다. */
export function gemSlots(odds, summary) {
  return odds.map((g) => {
    const count = summary?.counts?.[g.key] ?? 0;
    return { key: g.key, name: g.name, emoji: g.emoji, score: g.score, pct: g.pct, count, owned: count > 0 };
  });
}

/** 뽑기 버튼 상태. 최종 판정은 서버가 다시 한다. */
export function drawState(points, cost, ready) {
  if (!ready) return { enabled: false, label: "보석 확률 준비 중" };
  const balance = points?.balance ?? 0;
  if (balance < cost) return { enabled: false, label: `${cost - balance}포인트 더 모으면 뽑을 수 있어요` };
  return { enabled: true, label: `보석 뽑기 (−${cost})` };
}

/** 미션 인증방법에 맞는 입력칸. */
export function proofForm(method) {
  if (method === "사진") return { input: "file", hint: "사진을 골라 주세요. 얼굴·이름·연락처·학번은 가리고 올려 주세요." };
  if (method === "링크") return { input: "url", hint: "https://로 시작하는 주소를 붙여 넣어 주세요." };
  return { input: "textarea", hint: "한 일과 느낀 점을 적어 주세요. (1000자까지)" };
}
