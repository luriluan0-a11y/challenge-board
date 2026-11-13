// 서버 주소와 구글 로그인 클라이언트 ID. 둘 다 비밀 정보가 아니다.
// - 웹 앱 URL: 모든 요청은 서버에서 구글 토큰 확인 → 학생명단 대조를 통과해야 한다.
// - 클라이언트 ID: 구글 클라우드의 "승인된 JavaScript 원본"에 적은 주소에서만 로그인 버튼이 동작한다.
// 앱스 스크립트를 "새 배포"로 다시 만들면 URL이 바뀌므로 여기도 고친다 ("배포 관리 → 새 버전"은 그대로).
export const API_URL = "https://script.google.com/macros/s/AKfycbyBHQw0ZJd09z_DwK87_IvrN2OOugmKNYw6VQYyqLRk0LQEgS9pDJ12ewn35HbcsaIZWw/exec";
export const GOOGLE_CLIENT_ID = "384837655689-edaunq1jvre344ob75s8nu5smoopg0id.apps.googleusercontent.com";
