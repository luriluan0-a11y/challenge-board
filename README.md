---
author:
  - YoonYimLee
  - Claude Code
checked: false
tags: [취업준비]
---
# 챌린지보드

취업 준비를 돕는 개인 챌린지보드. 매일 습관과 공부를 체크해 달성률과 포인트를 쌓고, 추가 미션을 날짜별로 기록한다.

- 주소: https://luriluan0-a11y.github.io/challenge-board/
- 설계: [docs/spec.md](docs/spec.md)
- 기록은 각자의 브라우저(localStorage)에만 저장된다. 나중에 구글 로그인 + Firebase로 옮길 예정.

## 만든 방법

- HTML·CSS·JavaScript (빌드 없음)
- **TDD**: 계산 부분(`src/core.js`, `src/storage.js`)은 테스트(`tests/`)를 먼저 쓰고, 실패를 확인한 뒤 통과하는 코드를 썼다. 커밋 기록에 `test:`(실패하는 테스트) → `feat:`(통과하는 코드) 순서가 남아 있다.
- **자동 검사와 배포**: GitHub Actions가 올릴 때마다 테스트를 돌리고, 모두 통과해야만 GitHub Pages에 배포한다 (`.github/workflows/deploy.yml`).

```bash
npm test        # node --test (설치할 것 없음, Node 24)
```

## 진행

| 순서 | 기능 | 상태 |
| --- | --- | --- |
| 1 | 뼈대 + 오늘 탭 (체크, 지원 건수, 한 줄 메모, 달성률, 포인트, 저장, 자동 배포) | ✅ |
| 2 | 기록 탭 (달력 도장, 연속 일수, 배지, 지난 메모) | |
| 3 | 보상 탭 (잔액, 보상 상점, 구매 내역) | |
| 4 | 미션 탭 (날짜별 기록 + 링크, 보관함) | |
| 5 | 설정 탭 (항목·포인트·하루 시각, 백업) | |
