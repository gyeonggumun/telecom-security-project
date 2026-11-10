# 인증 계약 — A / C

POST 경로는 `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session/extend`입니다. 세션은 `GET /api/auth/me`로 조회합니다.

MySQL auth_sessions 공유 세션을 사용합니다. 무작위 opaque token 32바이트 이상을 발급하고 DB에는 SHA-256 해시를 저장합니다. 쿠키는 __Host-telecom_session, Secure/HttpOnly/SameSite=Lax, Path=/, Domain 미설정. 로그아웃이나 비밀번호·역할 변경 시 세션을 폐기합니다.

`/login`, `/me`, `/session/extend` 응답의 `data.session`에는 `created_at`, `last_seen_at`, `expires_at`, `max_expires_at`, `server_time`이 UTC로 포함됩니다. 화면은 서버 시각과 만료 시각을 기준으로 남은 시간을 표시합니다.

로그인과 수동 연장 후 60분 동안 세션이 유효합니다. 일반 API 호출로 만료 시각이 갱신되지 않습니다. `/session/extend`는 유효한 세션 쿠키와 `X-CSRF-Token`을 요구하며 요청 본문은 필요 없습니다. 최초 로그인 후 8시간이 지나거나 세션이 만료되면 다시 로그인해야 합니다.

상태 변경은 CSRF와 X-CSRF-Token, 로그인/가입은 JSON·Origin을 검증합니다. 비밀번호는 Argon2id 64MiB/3회/parallelism1/salt16/출력32바이트. 공유 DB 제한은 계정별 15분 5회, IP별 15분 20회, 초과 429+Retry-After입니다.

CUSTOMER는 본인 데이터, SUPPORT_ADMIN은 문의/모의 환불/멤버십 정책, SECURITY_ADMIN은 인시던트를 관리합니다. 공개 가입에서 관리자 역할을 선택하지 않습니다. 두 API 실행본 교차 인증과 고객 간 접근 거부를 검증합니다.
