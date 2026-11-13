---
author:
  - YoonYimLee
  - Claude Code
checked: false
tags: [취업준비]
---
# 챌린지보드

취업 준비를 돕는 개인 챌린지보드. 매일 습관과 공부를 체크해 달성률과 포인트를 쌓고, 추가 미션을 날짜별로 기록한다.

- 주소: https://challenge-board-seven.vercel.app/ (Vercel, 테스트를 통과해야 배포)
- 설계: [docs/spec.md](docs/spec.md)
- 로그인: 구글 로그인 → 앱스 스크립트 서버가 토큰 확인·학생명단 대조 (서버 주소와 클라이언트 ID는 `src/config.js`, 설치는 [docs/apps-script-setup.md](docs/apps-script-setup.md))
- 매일 체크 기록은 아직 각자의 브라우저(localStorage)에 저장된다. 다음 단계에서 시트로 옮긴다.

## 만든 방법

- HTML·CSS·JavaScript (빌드 없음)
- **TDD**: 계산 부분(`src/core.js`, `src/storage.js`)은 테스트(`tests/`)를 먼저 쓰고, 실패를 확인한 뒤 통과하는 코드를 썼다. 커밋 기록에 `test:`(실패하는 테스트) → `feat:`(통과하는 코드) 순서가 남아 있다.
- **자동 검사와 배포**: Vercel이 배포 전에 `npm test`를 돌리고, 모두 통과해야만 배포한다 (`vercel.json`). GitHub Actions도 올릴 때마다 테스트를 돌린다 (`.github/workflows/test.yml`).

```bash
npm test        # node --test (설치할 것 없음, Node 24)
```

## 진행

| 순서 | 기능 | 상태 |
| --- | --- | --- |
| 1 | 뼈대 + 오늘 탭 (체크, 지원 건수, 한 줄 메모, 달성률, 포인트, 브라우저 저장, 자동 배포) | ✅ |
| 2 | 구글 로그인 + 학생명단 확인 (앱스 스크립트) | ✅ |
| 3 | 미션 탭: 사진·링크·글 인증(+20), 인증 갤러리 | ✅ |
| 4 | 보석 탭: 서버에서 확률 뽑기, 내 보석함, 컴플리트 | ✅ |
| 5 | 오늘 탭 체크를 시트로 옮기기 (그 전까지 보석 포인트는 미션 포인트만) | |
| 6 | 순위 탭 | |
