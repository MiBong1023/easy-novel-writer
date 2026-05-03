# 쉬운 소설 작가 — 구조 문서

> 마지막 업데이트: 2026-05-03 (랜딩 페이지, 집중 모드, 글자 크기, 전체 내보내기, 작품 설명 수정, 통계 바, NovelCard 리디자인, 글쓰기 통계 페이지, 일별 작성량 자동 기록)

---

## 기술 스택

| 항목 | 버전 / 내용 |
|------|------------|
| 프레임워크 | React 19 + Vite 8 + TypeScript 6 |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, postcss 불필요) |
| 라우팅 | React Router v7 |
| 데이터베이스 | Firebase Firestore v12 |
| 인증 | Firebase Google Auth (익명 로그인 제거) |
| 배포 | Cloudflare Pages (`npm run build` → `dist/`) |
| 서버리스 함수 | Cloudflare Pages Functions (`functions/api/`) |

---

## Firestore 데이터 구조

```
users/{uid}/
  novels/{novelId}/
    title, description, episodeCount, createdAt, updatedAt
    episodes/{episodeId}/
      title, content, order, charCount, createdAt, updatedAt
      versions/{versionId}/           ← 5분마다 자동 스냅샷
        content, charCount, savedAt
    notes/{noteId}/                   ← 작품별 메모
      title, body, updatedAt
  stats/{YYYY-MM-DD}/                 ← 일별 글쓰기 통계
    date, charsAdded
```

---

## 화면 구성 (4개 페이지)

### 1. 홈 화면 `/`
**파일:** `src/pages/HomePage.tsx`

비로그인 상태에서는 **랜딩 페이지**를 표시. 로그인 후 작품 목록으로 전환.

#### 랜딩 페이지 (비로그인)
```
┌──────────────────────────────────────────────┐
│ 헤더: 앱 이름(좌)        다크모드 토글(우)      │
├──────────────────────────────────────────────┤
│                                              │
│        ✦ 한국어 소설 창작 전용 에디터           │  ← 뱃지
│                                              │
│          글쓰기에만                           │
│          집중하세요          ← 그라디언트 타이틀 │
│                                              │
│     방해 없는 깔끔한 에디터로…               │  ← 서브타이틀
│                                              │
│   [자동저장] [버전기록] [맞춤법검사] …         │  ← 기능 태그
│                                              │
│       [ G  Google로 시작하기 ]               │  ← CTA 버튼
│                                              │
└──────────────────────────────────────────────┘
```

#### 작품 목록 (로그인 후)
```
┌──────────────────────────────────────────────┐
│ 헤더: 앱 제목 | 다크모드 | +새작품 | 프로필   │
├──────────────────────────────────────────────┤
│  [작품카드]  [작품카드]  [작품카드]             │
└──────────────────────────────────────────────┘
```

- 작품 생성 폼 (제목 + 설명)
- 작품 목록 (3열 그리드)
- 작품 이름 인라인 수정 가능 (카드 호버 시 ✎ 버튼)
- 작품 삭제 (카드 호버 시 ✕ 버튼)
- 우상단 프로필 버튼 → 이름 표시 + 로그아웃

---

### 2. 작품 상세 화면 `/novels/:novelId`
**파일:** `src/pages/NovelPage.tsx`

```
┌──────────────────────────────────────────────┐
│ 헤더: ← 목록 | 작품제목 | 다크모드 | 로그인버튼  │
├──────────────────────────────────────────────┤
│  회차 목록                      [+ 새 회차]   │
│  ⠿  1화  제목  1,234자          ✎  ✕         │
│  ⠿  2화  제목    567자          ✎  ✕         │
└──────────────────────────────────────────────┘
```

- 회차 목록 (`order` 필드 기준 오름차순 정렬)
- 회차 드래그&드롭 순서 변경 (`⠿` 핸들, Firestore `order` 일괄 업데이트)
- **전체 내보내기** 버튼 (헤더) — 전체 회차를 하나의 `.txt` 파일로 다운로드 (회차 제목 구분선 포함)
- **작품 설명** 표시 및 인라인 수정 (클릭 → textarea, blur/Esc로 저장/취소)
- **통계 바** — 총 회차 수 · 총 글자수 (회차 목록 위)
- 회차 이름 인라인 수정 (✎ 버튼 → Enter 확인, Esc 취소)
- 회차 삭제 (✕ 버튼, confirm 다이얼로그)
- 새 회차 생성 (상단 폼)

---

### 3. 에디터 화면 `/novels/:novelId/episodes/:episodeId`
**파일:** `src/pages/EditorPage.tsx`

```
┌──────────────────────────────────────────────────────────┐
│ 헤더: ← 목록 | 회차제목 | ‹ › | 🗒️ | ↓txt | 다크 | 로그인  │
├──────────────────────────────────────────────────────────┤
│           진행바 (Progress Bar)                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   글쓰기 영역                          [오른쪽 패널 영역]  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              특수문자 패널 (하단 고정)                      │
└──────────────────────────────────────────────────────────┘
```

**헤더 버튼:**
- `← 목록`: 회차 목록으로 이동
- `‹` / `›`: 이전/다음 회차로 이동 (해당 회차가 있을 때만 표시)
- `🗒️`: 메모 패널 열기/닫기
- `↓ txt`: 현재 내용을 `.txt` 파일로 다운로드
- 다크모드 토글, 로그인 버튼

**집중 모드 (Focus Mode):**
- 진행바 `집중` 버튼으로 진입
- 활성화 시: 헤더 + 진행바 숨김, 에디터가 전체 화면 차지
- 우상단에 반투명 `Esc` 버튼 (호버 시 선명해짐)
- `Esc` 키 또는 버튼 클릭으로 해제

---

### 4. 글쓰기 통계 화면 `/stats`
**파일:** `src/pages/StatsPage.tsx`

- 로그인 필수 (비로그인 시 `/` 리디렉션)
- Firestore `users/{uid}/stats` 컬렉션 전체 로드

```
┌──────────────────────────────────────────────┐
│ 헤더: ← 목록 | 글쓰기 통계 | 다크모드           │
├──────────────────────────────────────────────┤
│  [오늘 N자] [이번 주 N자] [누적 N자] [연속 N일] │  ← 4개 StatCard
├──────────────────────────────────────────────┤
│  최근 14일 바 차트 (오늘=인디고, 기록=연보라)    │
└──────────────────────────────────────────────┘
```

- **StatCard** — 레이블 + 값 + 단위, 오늘 카드는 인디고 강조
- **바 차트** — 높이: `(값 / 최댓값) × 100%`, 호버 시 툴팁
- **연속 작성 스트릭** — 오늘(또는 어제)부터 역방향으로 연속 날짜 카운트

---

## 컴포넌트 상세

### 진행바 — `src/components/ProgressBar.tsx`
```
 1,234 / 6,000 자 (20%) · 공백 제외 1,100자 · 저장됨   [맞춤법] [기록] [자동변환] | [A-] [A+] | [집중]
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
- 글자수 / 목표 글자수 (목표는 클릭해서 수정 가능) / 공백 제외 글자수 / 저장 상태 — 왼쪽
- 버튼 — 오른쪽 (테두리 있는 버튼 스타일, 활성시 인디고 배경)
  - `맞춤법` / `기록` / `자동변환` | `A-` `A+` (글자 크기, 4단계) | `집중` (집중 모드 진입)

---

### 글쓰기 영역 — `src/components/Editor.tsx`
에디터 전체를 조율하는 컴포넌트. 아래 컴포넌트들과 훅들을 조합.

- 찾기/바꾸기 패널, 버전 기록 패널, 맞춤법 패널을 조건부 렌더링
- 맞춤법 오류 위치를 `Highlight` 배열로 변환해서 `HighlightTextarea`에 전달

---

### 텍스트 입력창 — `src/components/HighlightTextarea.tsx`
하이라이트(찾기 결과, 맞춤법 오류)를 텍스트 위에 오버레이로 표시.

**구조:**
```
div.overflow-hidden
├── div (백드롭: 하이라이트 HTML 렌더링, aria-hidden)
└── textarea (투명 배경, z-index 위, 실제 입력 받음)
```
- 백드롭의 `translateY`를 `onScroll`과 동기화해서 스크롤 일치
- 하이라이트 없을 땐 텍스트를 직접 표시 (투명 처리 안 함)

**하이라이트 타입 (CSS 클래스, `src/index.css`):**
| 타입 | 색상 | 의미 |
|------|------|------|
| 기본 (없음) | 노란 배경 | 찾기/바꾸기 일치 |
| `spell` | 빨간 배경 + 아랫줄 | 맞춤법 오류 |
| `space` | 파란 배경 + 아랫줄 | 띄어쓰기 오류 |
| `space_spell` | 빨간 배경 + 아랫줄 | 맞춤법+띄어쓰기 복합 |

---

### 특수문자 패널 — `src/components/SpecialCharPanel.tsx`
에디터 하단에 고정. 버튼 클릭 시 커서 위치에 문자 삽입.

- 기본 문자: `"` `"` `'` `'` `…` `—` `–`
- ✎ 버튼으로 편집 모드 진입 → 문자 추가/삭제 가능
- 설정은 `localStorage('specialChars')`에 저장

---

### 오른쪽 패널들 (에디터 위에 absolute 레이어)

#### 찾기/바꾸기 패널 — `src/components/FindReplacePanel.tsx`
- 단축키: `Cmd+F` (또는 `Ctrl+F`)
- 검색어 입력 → 일치 개수 표시 → 이전/다음 이동
- 바꾸기(현재) / 모두 바꾸기

#### 버전 기록 패널 — `src/components/VersionHistoryPanel.tsx`
- 진행바 "기록" 버튼으로 열기
- 최근 20개 버전 목록 (날짜 + 글자수)
- "복원" 버튼 → confirm 후 해당 버전으로 복원

#### 맞춤법 검사 패널 — `src/components/SpellCheckPanel.tsx`
- 진행바 "맞춤법" 버튼으로 열기/닫기
- Daum 맞춤법 API 사용 (Cloudflare Function이 프록시)
- 오류 목록: 원문 → 수정안 + 오류 유형 뱃지
- "교정" (개별) / "전체 교정" / "다시 검사" 버튼
- 오류 위치는 에디터 본문에도 색상으로 표시

#### 메모 패널 — `src/components/NotesPanel.tsx`
- 헤더 🗒️ 버튼으로 열기/닫기
- 작품 단위 메모 (Firestore `notes` 컬렉션)
- 메모 추가 / 클릭해서 내용 펼치기 / blur 시 자동 저장 / 삭제

---

## 훅 (Hooks)

| 훅 | 파일 | 역할 |
|----|------|------|
| `useAutoSave` | `src/hooks/useAutoSave.ts` | 1.5초 디바운스 Firestore 저장 + 5분마다 버전 스냅샷 + 증가분(`delta > 0`)만 `stats/{date}`에 누적 |
| `useEditor` | `src/hooks/useEditor.ts` | 탭(2칸), 스마트 따옴표, 자동변환(`...`→`…` 등), 커서 스크롤 |
| `useAutoConvert` | `src/hooks/useAutoConvert.ts` | 자동변환 ON/OFF 상태 (`localStorage`) |
| `useFindReplace` | `src/hooks/useFindReplace.ts` | 검색/치환 로직, 일치 위치 → `Highlight[]` 변환 |
| `useSpellCheck` | `src/hooks/useSpellCheck.ts` | Daum API 호출, 500자 청크 분할, 오류 파싱, dismiss |
| `useGoal` | `src/hooks/useGoal.ts` | 회차별 목표 글자수 (`localStorage`) |
| `useEditorSettings` | `src/hooks/useEditorSettings.ts` | 에디터 글자 크기 (4단계, `localStorage`) |
| `useWordCount` | `src/hooks/useWordCount.ts` | 전체/공백제외 글자수, 달성률(%) |
| `useNotes` | `src/hooks/useNotes.ts` | Firestore 메모 CRUD |
| `useAuth` | `src/hooks/useAuth.ts` | Firebase 인증 상태 구독 (user, loading 반환) |
| `useGoogleLogin` | `src/hooks/useGoogleLogin.ts` | Google 로그인 팝업 처리 |
| `useDarkMode` | `src/hooks/useDarkMode.ts` | 다크모드 토글, `localStorage` + `html.dark` 클래스 |

---

## 서버리스 함수

### `functions/api/spellcheck.ts`
Cloudflare Pages Function. POST `/api/spellcheck` → Daum 맞춤법 API 프록시.

- 텍스트를 500자 단위 청크로 분할 (`splitText`)
- 각 청크를 `https://dic.daum.net/grammar_checker.do` 에 POST
- 응답 HTML에서 `<a class="txt_spell_high">` 태그 파싱
  - `data-error-input`: 원문
  - `data-error-output`: 수정안
  - `data-error-type`: `spell` / `space` / `space_spell`
- 응답: `{ chunks: [{ original, html, errataCount }] }`

---

## 공통 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `AuthButton` | `src/components/AuthButton.tsx` | 익명: "Google로 계속하기" / 로그인: 프로필 사진 + 로그아웃 메뉴 |
| `DarkModeToggle` | `src/components/DarkModeToggle.tsx` | 다크모드 토글 버튼 |
| `NovelCard` | `src/components/NovelCard.tsx` | 홈화면 작품 카드 — 제목(인라인 수정), 설명, 회차 수 뱃지, 상대 시간(`timeAgo`) |

---

## 로컬 스토리지 키

| 키 | 저장 내용 |
|----|---------|
| `autoConvert` | 자동변환 ON/OFF (`"true"` / `"false"`) |
| `specialChars` | 특수문자 패널 문자 목록 (JSON) |
| `goal_${episodeId}` | 회차별 목표 글자수 |
| `editorFontSize` | 에디터 글자 크기 (`text-sm` / `text-base` / `text-lg` / `text-xl`) |
| `darkMode` | 다크모드 ON/OFF |
