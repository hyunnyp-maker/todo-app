# 06. 아키텍처

작성일: 2026-08-03
선행 문서: [`01-requirements.md`](./01-requirements.md) · [`05-design.md`](./05-design.md)

---

## 1. 스택 확정

| 층 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 15 (App Router) + TypeScript** | Supabase OAuth 콜백을 Route Handler로 처리. Vercel 배포가 기본 |
| 백엔드 | **Supabase** (Postgres · Auth · RLS) | v2의 카테고리별 권한을 DB 정책으로 확장 가능 |
| 서버 상태 | **TanStack Query v5** | 낙관적 업데이트 · 캐시 · 재시도가 내장. 요구사항 3.5의 절반을 라이브러리가 담당 |
| UI 상태 | **Zustand** (얇게) | 선택된 날짜 · 필터 · 달력 접힘 등 서버와 무관한 것만 |
| 스타일 | **Tailwind CSS + CSS 변수** | 팔레트 36토큰은 CSS 변수로 분리, 레이아웃은 Tailwind |
| 테스트 | **Vitest** | 날짜 계산 · 큐 병합 등 핵심 로직만 |
| 배포 | **Vercel** | GitHub 연동 자동 배포 |
| PWA | `app/manifest.ts` + 수동 Service Worker | 의존성 없이 앱 셸 캐시만. 필요해지면 `@serwist/next` 도입 |

### 채택하지 않은 것

| | 왜 안 썼나 |
|---|---|
| **Redux Toolkit / RTK Query** | 개인 1인용 앱에 보일러플레이트가 과하다. TanStack Query로 충분 |
| **Zustand 단독** | 낙관적 롤백 · 재시도 · 캐시 무효화를 전부 직접 만들어야 한다. 시간 예산 초과 |
| **Context + useState** | 3.5절(캐시 우선 + 큐)을 감당 못 함 |
| **Firebase** | 카테고리 단위 권한(v2)을 규칙 언어로 표현하기가 Postgres RLS보다 복잡 |
| **Vite (Phase 1 초안)** | OAuth 콜백 처리에 서버 라우트가 필요해졌다 |
| **CRDT · 오프라인 우선 프레임워크** | 개인 1인 사용이라 동시 편집 충돌이 구조적으로 없다. 병합 알고리즘이 불필요 |
| **자유 컬러피커** | 디자인 결정 (P9) |

---

## 2. 폴더 구조

```
to do app/
├─ docs/                              기획 문서 (01~07)
│  └─ mockups/index.html
├─ public/
│  ├─ icons/  icon-192.png · icon-512.png · apple-touch-icon.png
│  └─ sw.js                           앱 셸 캐시 (E2)
├─ supabase/
│  └─ migrations/
│     └─ 0001_init.sql                테이블 · RLS · 인덱스
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                   루트 레이아웃 · 폰트 · 메타
│  │  ├─ providers.tsx                QueryClientProvider · SessionProvider
│  │  ├─ page.tsx                     홈 — 달력 + 리스트 + 입력 바
│  │  ├─ manifest.ts                  PWA manifest
│  │  ├─ globals.css                  CSS 변수(팔레트 36) · Tailwind 지시자
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ signup/page.tsx
│  │  │  └─ reset/page.tsx
│  │  ├─ auth/callback/route.ts       OAuth · 매직링크 콜백
│  │  └─ settings/page.tsx            계정 · 완료 숨기기 · PWA 안내
│  │
│  ├─ domain/                         ★ 순수 함수만. React·Supabase 의존 없음
│  │  ├─ types.ts                     Category · Task · CheckMode · QueueOp
│  │  ├─ palette.ts                   12색 키 → 3톤 토큰
│  │  ├─ date.ts                      월 그리드 · 기간 겹침 · D-day
│  │  ├─ task.ts                      완료 판정 · 진행률 · 밀림 필터 · 정렬
│  │  └─ category.ts                  삭제 정책 · 미사용 색 추천
│  │
│  ├─ data/
│  │  ├─ repository.ts                TodoRepository 인터페이스
│  │  ├─ local/
│  │  │  ├─ localRepository.ts        localStorage 구현 (게스트)
│  │  │  ├─ storage.ts                직렬화 · 스키마 버전 · 손상 복구
│  │  │  └─ seed.ts                   기본 카테고리 3개
│  │  ├─ supabase/
│  │  │  ├─ client.ts                 브라우저 클라이언트
│  │  │  ├─ server.ts                 Route Handler용 클라이언트
│  │  │  ├─ supabaseRepository.ts     Supabase 구현 (로그인)
│  │  │  └─ mappers.ts                snake_case ↔ camelCase
│  │  ├─ sync/
│  │  │  ├─ queue.ts                  큐 적재 · 영속화
│  │  │  ├─ merge.ts                  동일 엔티티 연산 병합 (규칙 7)
│  │  │  └─ flush.ts                  온라인 복귀 시 순차 전송
│  │  └─ migration/
│  │     └─ guestToAccount.ts         게스트 → 계정 병합 업로드
│  │
│  ├─ hooks/
│  │  ├─ useRepository.ts             세션에 따라 local/supabase 선택
│  │  ├─ useCategories.ts             useCategoryMutations.ts
│  │  ├─ useTasks.ts                  useTaskMutations.ts
│  │  ├─ useSession.ts
│  │  └─ useOnlineStatus.ts
│  │
│  ├─ stores/
│  │  └─ uiStore.ts                   selectedDate · visibleMonth · hiddenCategoryIds
│  │                                  · calendarCollapsed · hideCompleted
│  ├─ components/
│  │  ├─ calendar/  MonthCalendar · CalendarCell · WeekStrip · MonthHeader
│  │  ├─ category/  CategoryBand · CategoryChip · CategoryEditSheet · ColorPalette
│  │  ├─ task/      TaskList · TaskCard · TaskDetailSheet · OverdueFold
│  │  ├─ input/     QuickAddBar
│  │  ├─ sync/      SyncBadge
│  │  └─ ui/        Sheet · Checkbox · Chip · ConfirmDialog · EmptyState
│  │
│  └─ lib/
│     ├─ env.ts                       환경변수 검증
│     └─ cn.ts
│
├─ .env.example
├─ .env.local                         ★ .gitignore
├─ next.config.ts
├─ vitest.config.ts
└─ package.json
```

### 계층 규칙

```
components  →  hooks  →  data  →  (Supabase / localStorage)
                 ↓
              domain            ← 순수 함수. 어디서든 import 가능, 아무것도 import 안 함
```

- `domain/`은 **React와 Supabase를 모른다.** 그래서 테스트가 쉽다 (A4의 대상)
- `components/`는 `data/`를 직접 부르지 않는다. 항상 `hooks/`를 거친다
- `stores/uiStore`에는 **서버에서 온 데이터를 넣지 않는다.** 서버 데이터는 TanStack Query가 유일한 소유자

---

## 3. 데이터 스키마

### 3.1 마이그레이션 `supabase/migrations/0001_init.sql`

```sql
-- ── 카테고리 ────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  color       text not null,          -- 팔레트 키: 'sage' | 'mist' | ...
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ── 할일 ────────────────────────────────────
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  category_id     uuid references public.categories(id) on delete set null,
  title           text not null check (char_length(title) between 1 and 200),
  memo            text,
  start_date      date not null,
  end_date        date not null,
  check_mode      text not null default 'once'
                    check (check_mode in ('once','daily')),
  done            boolean not null default false,
  completed_dates date[] not null default '{}',
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint valid_range check (end_date >= start_date)
);

-- ── 인덱스 ──────────────────────────────────
-- 달력은 "표시 중인 달"만 조회한다 (요구사항 6.1)
create index tasks_owner_range_idx
  on public.tasks (owner_id, start_date, end_date);
create index categories_owner_idx
  on public.categories (owner_id, sort_order);

-- ── RLS ─────────────────────────────────────
alter table public.categories enable row level security;
alter table public.tasks      enable row level security;

create policy "own categories" on public.categories
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own tasks" on public.tasks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ── updated_at 자동 갱신 ─────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
```

> **v2 확장 지점**: `own categories` / `own tasks` 정책에
> `or exists (select 1 from category_shares s where ...)` 를 더하는 것으로 공유가 열린다.
> 클라이언트 코드는 바뀌지 않는다.

### 3.2 도메인 타입 `src/domain/types.ts`

```ts
export type PaletteKey =
  | 'sage' | 'rose' | 'mist' | 'lavender' | 'clay'  | 'mustard'
  | 'olive'| 'teal' | 'plum' | 'sand'     | 'slate' | 'coral';

export type CheckMode = 'once' | 'daily';
export type ISODate  = string;   // "YYYY-MM-DD"

export interface Category {
  id: string;
  name: string;
  color: PaletteKey;
  sortOrder: number;
}

export interface Task {
  id: string;
  categoryId: string | null;      // null = 미분류
  title: string;
  memo?: string;
  startDate: ISODate;
  endDate: ISODate;
  checkMode: CheckMode;
  done: boolean;                  // checkMode: 'once' 전용
  completedDates: ISODate[];      // checkMode: 'daily' 전용
  sortOrder: number;
  createdAt: string;
}

/** 게스트 모드 localStorage 구조 */
export interface GuestData {
  schemaVersion: 1;
  categories: Category[];
  tasks: Task[];
  migrationAsked: boolean;
}
```

### 3.3 저장소 인터페이스 `src/data/repository.ts`

**게스트와 로그인의 차이를 이 인터페이스 하나로 흡수한다.**
위쪽(hooks·components)은 자기가 어느 모드인지 모른다.

```ts
export interface DateRange { from: ISODate; to: ISODate }

export interface TodoRepository {
  listCategories(): Promise<Category[]>;
  createCategory(input: Omit<Category,'id'>): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<Category>;
  /** mode: 'orphan' = 할일을 미분류로 | 'cascade' = 함께 삭제 */
  deleteCategory(id: string, mode: 'orphan' | 'cascade'): Promise<void>;

  /** range와 겹치는 모든 할일 (기간형 포함) */
  listTasks(range: DateRange): Promise<Task[]>;
  createTask(input: Omit<Task,'id'|'createdAt'>): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}
```

**기간 겹침 조회** — 단순 `start_date >= from` 이 아니다. 3/28~4/3 할일은 4월 조회에도 나와야 한다.

```sql
where start_date <= :to and end_date >= :from
```

### 3.4 큐 연산 타입

```ts
export type QueueOp =
  | { kind:'task.create';     seq:number; entityId:string; payload:Task }
  | { kind:'task.update';     seq:number; entityId:string; patch:Partial<Task> }
  | { kind:'task.delete';     seq:number; entityId:string }
  | { kind:'category.create'; seq:number; entityId:string; payload:Category }
  | { kind:'category.update'; seq:number; entityId:string; patch:Partial<Category> }
  | { kind:'category.delete'; seq:number; entityId:string; mode:'orphan'|'cascade' };
```

`entityId`는 **클라이언트에서 uuid를 생성**해 채운다. 서버가 id를 만들 때까지 기다리면
오프라인에서 만든 할일을 곧바로 수정할 수 없다.

---

## 4. 상태 흐름

### 4.1 저장소 선택

```
                    useSession()
                         │
              ┌──────────┴──────────┐
         세션 없음                세션 있음
              │                     │
      LocalRepository        SupabaseRepository
     (localStorage)          (+ 재시도 큐 래핑)
              └──────────┬──────────┘
                         ▼
                  TodoRepository
                         │
              useTasks / useCategories
                         │
                    컴포넌트
```

컴포넌트는 게스트인지 로그인인지 **알지 못한다.** 로그아웃하면 저장소만 갈아끼워진다.

### 4.2 읽기 — 캐시 우선 (요구사항 3.5 규칙 1)

```
앱 시작
   │
   ├─ TanStack Query 캐시를 localStorage에서 복원 (persister)
   │     └─ 즉시 렌더  ← 스피너 없음. S2(지하철)가 여기서 성립
   │
   └─ 백그라운드 refetch
         ├─ 성공 → 캐시 갱신 → 화면 갱신
         └─ 실패 → 조용히 무시. 이미 보여준 것을 치우지 않는다
```

```ts
// 쿼리 키 — 달 단위로 캐시
['tasks', ownerScope, visibleMonth]      // "2026-08"
['categories', ownerScope]
```

`staleTime`은 짧게(30초), `gcTime`은 길게(24시간). 오프라인에서 캐시가 살아 있어야 한다.

### 4.3 쓰기 — 낙관적 반영 + 큐

```
사용자가 체크
   │
   ├─ ① onMutate: 캐시를 즉시 수정        ← 화면이 0ms에 바뀜 (E3)
   │
   ├─ ② repository.updateTask() 호출
   │        ├─ 성공 → onSettled: invalidate. 끝
   │        │
   │        ├─ 네트워크 실패 → queue.push(op)
   │        │      화면은 그대로. SyncBadge에 "동기화 대기 1"
   │        │      ※ 에러가 아니라 대기 상태 (규칙 3)
   │        │
   │        └─ 4xx 등 최종 실패 → onError: 캐시 롤백 + 배너 (규칙 5)
   │
   └─ ③ online 이벤트 → flush()
            seq 순서대로 전송 (규칙 4)
            같은 entityId 연산은 merge()로 합침 (규칙 7)
```

### 4.4 큐 병합 규칙 `data/sync/merge.ts`

| 앞 | 뒤 | 결과 |
|---|---|---|
| `create` | `update` | `create` (payload에 patch 반영) |
| `create` | `delete` | **둘 다 제거** — 서버에 간 적이 없다 |
| `update` | `update` | `update` (patch 병합) |
| `update` | `delete` | `delete` |
| `delete` | 무엇이든 | `delete` 유지 |

병합은 **같은 `entityId`에 대해서만**, 순서를 보존하며 수행한다.

### 4.5 게스트 → 계정 이관 `data/migration/guestToAccount.ts`

```
로그인 성공
   │
   ├─ GuestData 있음? ── 아니오 → 끝
   │        │ 예
   │        ▼
   │   migrationAsked === true? ── 예 → 끝 (다시 묻지 않음)
   │        │ 아니오
   │        ▼
   │   "할일 N개를 계정으로 가져올까요?"
   │        ├─ [그냥 두기] → migrationAsked = true. 끝
   │        └─ [가져오기]
   │              ├─ 계정 카테고리 조회
   │              ├─ 이름이 같은 것 → 기존 id로 매핑 (새로 만들지 않음)
   │              ├─ 없는 것만 생성
   │              ├─ 할일을 매핑된 categoryId로 일괄 삽입
   │              ├─ 전부 성공 → localStorage 비움
   │              └─ 하나라도 실패 → **비우지 않음** + 재시도 안내
```

**덮어쓰지 않고 병합한다.** 계정에 이미 데이터가 있어도 게스트 데이터를 얹는다.

---

## 5. 외부 서비스 연동

### 5.1 Supabase

| | |
|---|---|
| 클라이언트 | `@supabase/ssr` — 브라우저/서버 각각의 클라이언트 생성 |
| 세션 | 쿠키 기반. Route Handler에서 갱신 |
| 노출 키 | **`NEXT_PUBLIC_SUPABASE_ANON_KEY` 만.** service role key는 클라이언트로 나가지 않는다 |
| 보호 | 모든 접근이 RLS를 통과한다. anon key가 유출돼도 남의 데이터는 못 읽는다 |

```
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local`은 `.gitignore`에 넣는다. `lib/env.ts`에서 시작 시 존재를 검증하고, 없으면 명확한 에러를 던진다.

### 5.2 인증 흐름

```
이메일 + 비밀번호
   signUp() → 인증 메일 → 링크 클릭 → /auth/callback → 세션 수립

Google OAuth
   signInWithOAuth({provider:'google'})
     → Google 동의 화면
     → /auth/callback?code=...
     → exchangeCodeForSession() → 홈으로

비밀번호 재설정
   resetPasswordForEmail() → 메일 → /reset → updateUser({password})
```

**사전 준비 (구현 단계에서 사용자가 직접 수행)**

1. Supabase 프로젝트 생성 → URL · anon key 확보
2. Google Cloud Console → OAuth 클라이언트 ID 발급
   - 승인된 리디렉션 URI: `https://<project>.supabase.co/auth/v1/callback`
3. Supabase Authentication → Providers → Google 에 클라이언트 ID/시크릿 입력
4. Supabase Auth → URL Configuration → Site URL / Redirect URLs 에 로컬·배포 주소 등록

### 5.3 PWA (E2)

| | |
|---|---|
| manifest | `app/manifest.ts` — 이름 · 아이콘 192/512 · `display: standalone` · `theme_color: #1C1F23` |
| Service Worker | `public/sw.js` — **앱 셸만** 캐시 (HTML/JS/CSS). 데이터는 TanStack Query persister가 담당 |
| 등록 | 클라이언트 컴포넌트에서 `navigator.serviceWorker.register('/sw.js')` |
| 전략 | 앱 셸 = stale-while-revalidate. API 요청은 SW가 건드리지 않는다 |
| 설치 유도 | **자동 팝업 없음.** 설정 화면 안내 한 줄만 |

---

## 6. 성능

| 항목 | 방법 |
|---|---|
| 조회 범위 | 표시 중인 달 ± 1주만. `tasks_owner_range_idx` 사용 |
| 인접 달 | 현재 달 렌더 후 이전/다음 달을 `prefetchQuery` |
| 달력 재계산 | 월 그리드는 `useMemo`. 날짜별 할일 매핑은 `Map<ISODate, Task[]>`를 한 번만 구성 |
| 웹폰트 | 로드하지 않음 (시스템 폰트) |
| 첫 렌더 | 캐시 우선. 스피너로 화면을 막지 않음 |
| 번들 | 홈 외 라우트(로그인·설정)는 자동 코드 분할 |

---

## 7. 테스트 (Vitest)

`domain/`이 순수 함수라서 여기만 테스트하면 핵심이 덮인다.

| 파일 | 테스트 대상 |
|---|---|
| `domain/date.test.ts` | 월 그리드 생성(6주 케이스) · 기간 겹침 · 달 경계(3/28~4/3) · D-day |
| `domain/task.test.ts` | 지속형 완료 판정 · 진행률 · **밀림 필터(지속형 제외)** · 정렬(미완료→완료, 지속형 뒤) |
| `domain/category.test.ts` | 삭제 정책(orphan/cascade) · 미사용 색 추천 |
| `data/sync/merge.test.ts` | 큐 병합 5가지 조합 · 순서 보존 |
| `data/local/storage.test.ts` | 손상된 JSON 복구 · 스키마 버전 |

**테스트하지 않는 것**: 컴포넌트 렌더, Supabase 통신. 수동 확인으로 대체한다.

---

## 8. 보안 체크리스트

- [ ] `.env.local` 이 `.gitignore`에 있다
- [ ] 커밋된 키가 없다 (`git log -p | grep -i "service_role"`)
- [ ] 두 테이블 모두 RLS가 **enable** 되어 있다
- [ ] 다른 계정으로 로그인해 남의 데이터가 안 보이는지 확인
- [ ] `owner_id`를 클라이언트가 임의로 지정할 수 없다 (`with check` 로 강제)
- [ ] Supabase Redirect URL에 배포 도메인이 등록돼 있다
- [ ] 로그아웃 시 로컬 캐시 · 큐가 비워진다

---

## 9. 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| **한글 IME Enter 중복** | E1(한 줄 추가)이 무너짐 | `isComposing` 가드. 구현 즉시 실기기 확인 |
| **캐시 persist 용량** | localStorage 5MB 초과 | 캐시는 최근 3개월 쿼리만 유지 |
| **큐가 계속 실패** | 무한 재시도 | 3회 실패 시 최종 실패로 승격, 롤백 + 알림 |
| **오프라인 생성 id 충돌** | 중복 행 | 클라이언트 uuid v4 사용. 서버 `id`를 덮어쓰지 않음 |
| **375px 세로 예산 초과** | P3(한 화면)이 깨짐 | 05-design 4.2 표로 매번 검산 |
| **v1 편의를 위한 하드코딩** | v2에서 전면 재작업 | `.eq('owner_id', ...)` 금지. RLS에 위임 (T5) |

---

## 10. 다음 단계

Phase 7 — 구현 계획 (`07-plan.md`)
