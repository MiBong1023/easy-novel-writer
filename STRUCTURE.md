# 쉬운 소설 작가 — 구조 문서

> 마지막 업데이트: 2026-05-05 (SEO 메타태그·OG·Twitter Card, sitemap.xml, robots.txt, Sentry 오류 모니터링, Cloudflare Analytics)

---

## 기술 스택

| 항목 | 버전 / 내용 |
|------|------------|
| 프레임워크 | React 19 + Vite 8 + TypeScript 6 |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, postcss 불필요) |
| 라우팅 | React Router v7 |
| 데이터베이스 | Firebase Firestore v12 |
| 인증 | Firebase Google Auth |
| 배포 | Cloudflare Pages (`npm run build` → `dist/`) |
| 서버리스 함수 | Cloudflare Pages Functions (`functions/api/`) |
| AI 엔진 | Google Gemini 2.5 Flash (무료 티어, `GEMINI_API_KEY` 환경 변수) |
| PWA | Web App Manifest (`public/manifest.json`) + Service Worker (`public/sw.js`) |
| 보안 규칙 | Firestore Security Rules (`firestore.rules`) |
| 오류 모니터링 | Sentry (`@sentry/react`, `VITE_SENTRY_DSN` 환경 변수, 프로덕션만 활성화) |
| 웹 분석 | Cloudflare Web Analytics (index.html 스크립트 태그) |

---

## Firestore 데이터 구조

```
users/{uid}/
  novels/{novelId}/
    title, description, userId, episodeCount, color?, tags?, totalChars?
    lastEpisodeTitle?, lastEpisodeId?   ← 마지막 편집 회차 캐시
    createdAt, updatedAt
    episodes/{episodeId}/
      title, content, order, charCount, excerpt?(첫 80자)
      createdAt, updatedAt
      versions/{versionId}/            ← 5분마다 자동 스냅샷
        content, charCount, savedAt
    notes/{noteId}/                    ← 작품별 메모
      title, body, pinned?, updatedAt
  stats/{YYYY-MM-DD}/                  ← 일별 글쓰기 통계
    date, charsAdded

shares/{shareId}/                      ← 공개 공유 링크 (인증 불필요 읽기)
  novelTitle, episodeTitle, content
  createdAt, expiresAt?
```

---

## 화면 구성

### 1. 홈 화면 `/`
**파일:** `src/pages/HomePage.tsx`

비로그인 상태에서는 **랜딩 페이지** 표시. 로그인 후 작품 목록으로 전환.

#### 헤더 버튼 (로그인 후)
- `✨ AI로 시작` — WritingWizard 모달 열기 (데스크탑만)
- `+ 새 작품` — 작품 생성 폼 펼치기
- 다크모드 토글, 프로필/로그아웃

#### 기능
- **작품 검색** — 제목·설명·마지막회차제목·태그 실시간 필터링
- **정렬** — 최근 수정 / 제목순 / 회차 많은 순
- **태그 필터** — 장르 칩으로 필터링 (태그가 1개 이상일 때 표시)
- **카드 클릭** — `lastEpisodeId` 캐시 있으면 즉시 이동, 없으면 Firestore 쿼리
- **연속 작성 배지** 🔥 — 오늘 기준 연속 작성 일수 헤더에 표시
- **WritingWizard** — "AI로 시작" 클릭 시 4단계 마법사 → 소설+1화 자동 생성 → 에디터 이동

---

### 2. 작품 상세 화면 `/novels/:novelId`
**파일:** `src/pages/NovelPage.tsx`

#### 기능
- 회차 목록 (`order` 필드 기준 오름차순)
- **드래그&드롭** 순서 변경 (데스크탑, `⠿` 핸들)
- **↑↓ 버튼** 순서 변경 (모바일, 검색 중에는 숨김)
- **전체 내보내기** → `.txt` (헤더, 데스크탑만)
- **작품 설명** 인라인 수정
- **통계 바** — 총 회차 · 총 글자수 · 평균 · 페이지 수
- **회차 검색** (5회차 이상일 때 표시)
  - 제목 + excerpt(요약) 필터링
  - **전체 ON** 버튼 → Firestore에서 모든 회차 본문 로드 후 전문 검색
  - 딥서치 매칭 시 앰버색 스니펫 표시
- 회차 이름 인라인 수정, 복사(⎘), 삭제(✕)
- **일괄 선택 삭제** — "선택" 버튼 → 체크박스 → "N개 삭제"
- 회차별 목표 진행바 (localStorage `goal-{episodeId}` 기준)

---

### 3. 에디터 화면 `/novels/:novelId/episodes/:episodeId`
**파일:** `src/pages/EditorPage.tsx`

#### 헤더 버튼
- `← 목록`, `‹` / `›` (이전/다음 회차), `🗒️` (메모), `↓ md`, `↓ pdf`, `↓ txt`
- 공유 링크 팝오버 (24h / 7d / 영구), `?` 단축키 도움말
- 다크모드, 로그인버튼 (데스크탑만)
- `⋯` 모바일 오버플로우 메뉴

#### 집중 모드 (Focus Mode)
- 헤더 + 진행바 숨김, 에디터 전체 화면
- **하단 중앙 오버레이** — 현재 글자수 + "Esc 나가기" 버튼 (반투명, 호버 시 선명)
- `Esc` 또는 `Cmd+Shift+F`로 토글

#### 기타
- `Cmd+S` 즉시 저장, `Cmd+F` 찾기/바꾸기, `Cmd+P` 미리보기
- **스크롤 위치 복원** — 회차 열 때 마지막 스크롤 위치 복원 (localStorage `scroll-{episodeId}`)
- **lastEpisodeId 저장** — 에피소드 진입 시 novel 문서에 기록 (홈 카드 클릭 최적화)
- 공유 링크 생성 → 클립보드 복사 → 토스트 메시지

---

### 4. 공유 페이지 `/share/:shareId`
**파일:** `src/pages/SharePage.tsx`

- 인증 불필요 (공개 읽기)
- 공유 링크 유효 여부 확인 (`expiresAt` 비교)
- 만료 또는 없음 → 안내 화면

---

### 5. 글쓰기 통계 화면 `/stats`
**파일:** `src/pages/StatsPage.tsx`

#### 상단 카드 (4개)
- **오늘** — 일일 목표 설정(클릭 수정), 진행바, "🎉 목표 달성!" / %, 알림 허용 버튼
- **이번 주** / **누적** / **연속 작성 N일**

#### 주간 비교 섹션
- 이번 주 vs 지난 주 수평 바 차트
- ▲/▼ % 차이 + "N자 더/덜 썼어요" 텍스트

#### 최근 14일 바 차트
- 오늘 마커(▼), 호버 툴팁
- 일일 목표 점선 (maxVal 이하일 때 표시)

#### 작품별 현황
- 총 글자수 기준 바 차트 + 회차 수

#### 연간 잔디 뷰
- GitHub 스타일, 4단계 초록색 농도
- 월 레이블, 오늘 링 표시, 범례

#### 목표 알림 (Notification API)
- 오늘 통계가 일일 목표 이상일 때 브라우저 알림
- `sessionStorage`로 중복 방지, 권한 차단 시 "알림 차단됨" 표시

---

## 컴포넌트 상세

### 진행바 — `src/components/ProgressBar.tsx`
```
 1,234 / 6,000자 (20%) · 공백 제외 · 저장됨   [맞춤법][기록][자동변환] | [A-][A+] | [AI] | [집중]
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
- **집중 타이머** — ⏱ 버튼 → 15/25/50분 팝오버 → 카운트다운 (30초 이하 빨간 펄스) → "✓ 완료!"
- 모바일 `⋯` 메뉴 — 숨겨진 버튼 표시 (집중 타이머 포함)

---

### 글쓰기 영역 — `src/components/Editor.tsx`
- 찾기/바꾸기, 버전 기록, 맞춤법, AI 패널 조건부 렌더링
- **스크롤 복원** — 마운트 시 `localStorage['scroll-{episodeId}']` 읽어 적용
- `onScrollTop` prop으로 `HighlightTextarea`에서 스크롤 이벤트 수신

---

### 텍스트 입력창 — `src/components/HighlightTextarea.tsx`
- `onScrollTop?: (scrollTop: number) => void` prop 추가
- 백드롭 `translateY` 동기화 + 외부 스크롤 콜백 동시 호출

---

### 특수문자 패널 — `src/components/SpecialCharPanel.tsx`
에디터 하단 고정. `"` `"` `'` `'` `…` `—` `–` 등, ✎ 편집 모드로 커스터마이징.

---

### 오른쪽 패널들 (에디터 위 absolute 레이어)

| 패널 | 파일 | 열기 방법 |
|------|------|---------|
| 찾기/바꾸기 | `FindReplacePanel.tsx` | `Cmd+F` |
| 버전 기록 | `VersionHistoryPanel.tsx` | 진행바 "기록" |
| 맞춤법 검사 | `SpellCheckPanel.tsx` | 진행바 "맞춤법" |
| 메모 | `NotesPanel.tsx` | 헤더 🗒️ |
| AI 보조 | `AIPanel.tsx` | 진행바 "AI" |

#### AI 글쓰기 보조 패널 — `src/components/AIPanel.tsx`
- **Gemini 2.5 Flash** 기반 (스트리밍 실시간 타이핑 효과)
- 6개 도움 유형 버튼 (3열 그리드):
  - 이어쓰기 / 문장 다듬기 / 더 구체적으로 / 길이 줄이기 / 어조 변경 / 맞춤법 교정
- 직접 요청 텍스트 입력 (Enter 전송)
- 세션 내 대화 히스토리 유지 (반복 요청 가능)
- 결과 → `삽입` (커서 위치 삽입) / `초기화`

#### 메모 패널 — `src/components/NotesPanel.tsx`
- 핀 고정 (📌, 핀된 메모 상단 표시)
- 노트 3개 이상 시 검색 인풋 표시
- blur 시 자동 저장

---

### AI 글쓰기 마법사 — `src/components/WritingWizard.tsx`
4단계 모달 마법사. 홈 "✨ AI로 시작" 버튼으로 진입.

| 단계 | 내용 |
|------|------|
| **시작** | "글쓰기가 처음이신가요?" YES/NO |
| **기본 설정** | 글 형식(웹소설/순문학/에세이/일기/기타) + 장르(웹소설일 때) + 목적 + 제목 |
| **소재 구체화** | Gemini와 채팅 — 키워드 입력 → AI가 인물·사건·배경·갈등 질문, 스트리밍 응답 |
| **초안 생성** | 구조 선택(한줄 로그라인/5문장/3막/장면목록) → Gemini 첫 장면 스트리밍 생성 |

완료 시: Firestore에 소설 + 1화 자동 생성 → 에디터 이동

---

### 공통 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `AuthButton` | 로그인/로그아웃 |
| `DarkModeToggle` | 다크모드 토글 |
| `NovelCard` | 홈 작품 카드 — 컬러 바, 제목/설명 인라인 수정, 장르 태그, 작성 시간 |
| `ShortcutsModal` | 단축키 도움말 모달 |
| `ErrorBoundary` | JS 오류 → 안내 화면 |
| `PreviewModal` | 글 미리보기 (읽기 전용) |
| `ProgressBar` | 글자수·목표·저장상태·버튼 모음 |

---

## 훅 (Hooks)

| 훅 | 파일 | 역할 |
|----|------|------|
| `useAutoSave` | `hooks/useAutoSave.ts` | 1.5초 디바운스 저장 + 버전 스냅샷(5분) + stats 증가분 누적 + `saveNow()` 노출 |
| `useEditor` | `hooks/useEditor.ts` | 탭 들여쓰기, 스마트 따옴표, `...`→`…` / `--`→`—` 자동변환, `insertAt` |
| `useAutoConvert` | `hooks/useAutoConvert.ts` | 자동변환 ON/OFF (localStorage) |
| `useFindReplace` | `hooks/useFindReplace.ts` | 검색/치환 로직, `Highlight[]` 변환 |
| `useSpellCheck` | `hooks/useSpellCheck.ts` | Daum API 호출, 500자 청크 분할, 오류 파싱 |
| `useGoal` | `hooks/useGoal.ts` | 회차별 목표 글자수 (localStorage) |
| `useEditorSettings` | `hooks/useEditorSettings.ts` | 글자 크기 4단계 (localStorage) |
| `useWordCount` | `hooks/useWordCount.ts` | 전체/공백제외 글자수, 달성률 |
| `useNotes` | `hooks/useNotes.ts` | Firestore 메모 CRUD + 핀 토글 |
| `useTimer` | `hooks/useTimer.ts` | 카운트다운 타이머 (15/25/50분) |
| `useAuth` | `hooks/useAuth.ts` | Firebase 인증 상태 구독 |
| `useGoogleLogin` | `hooks/useGoogleLogin.ts` | Google 로그인 팝업 |
| `useDarkMode` | `hooks/useDarkMode.ts` | 다크모드 토글, `prefers-color-scheme` 감지 |

---

## 서버리스 함수

### `functions/api/gemini.ts` ← 신규
Gemini 2.5 Flash API 프록시.

- **환경 변수**: `GEMINI_API_KEY` (Cloudflare Pages 설정)
- Body: `{ messages: GeminiMessage[], systemPrompt?: string, stream?: boolean }`
- 스트리밍: `streamGenerateContent?alt=sse` → SSE 그대로 패스스루
- 비스트리밍: `generateContent` → `{ result: string }`
- 429 한도 초과 시 친화적 오류 메시지

### `functions/api/spellcheck.ts`
Daum 맞춤법 API 프록시. 500자 청크 분할 → HTML 파싱 → `{ chunks }` 반환.

### `functions/api/ai.ts`
기존 Anthropic Claude 프록시 (현재 미사용, 레거시 보존).

---

## 클라이언트 라이브러리

### `src/lib/gemini.ts`
Gemini API 클라이언트 헬퍼.

- `streamGemini(messages, systemPrompt, onChunk, signal?)` — SSE 스트리밍, chunk 단위 콜백
- `callGemini(messages, systemPrompt)` — 단일 응답 반환
- `msg(role, text)` — GeminiMessage 생성 헬퍼
- `getAIUsageToday()` / `incrementAIUsage()` / `isAILimitReached()` / `aiUsageWarning()` — 일일 사용량 추적

---

## 로컬 스토리지 키

| 키 | 저장 내용 |
|----|---------|
| `autoConvert` | 자동변환 ON/OFF |
| `specialChars` | 특수문자 패널 목록 (JSON) |
| `goal-{episodeId}` | 회차별 목표 글자수 |
| `editorFontSize` | 에디터 글자 크기 |
| `darkMode` | 다크모드 ON/OFF |
| `scroll-{episodeId}` | 에디터 스크롤 위치 (px) |
| `daily-writing-goal` | 통계 일일 목표 글자수 |
| `ai-usage-YYYY-MM-DD` | 당일 AI 호출 횟수 (하루 250회 한도) |

## 세션 스토리지 키

| 키 | 저장 내용 |
|----|---------|
| `goal-notif-{YYYY-MM-DD}` | 당일 목표 달성 알림 발송 여부 |
