"use client";

import { useRef, useState } from "react";
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "@/domain/category";
import { toneOf } from "@/domain/palette";
import type { Category } from "@/domain/types";

interface Props {
  categories: Category[];
  hiddenIds: string[];
  /** 미분류 할일이 하나라도 있을 때만 칩을 낸다 */
  showUncategorized: boolean;
  onToggle: (id: string) => void;
  onEdit: (category: Category) => void;
  onAdd: () => void;
  onReorder: (ids: string[]) => void;
}

const LONG_PRESS_MS = 420;
const MOVE_THRESHOLD = 8;

/**
 * 카테고리 밴드 — 시안 C의 핵심 (05-design 5.2).
 *
 * 한 칩에 세 동작이 얹혀 있고, 입력 장치에 따라 진입 방법이 다르다.
 *
 *   마우스  탭 = 필터 / 그냥 끌기 = 순서 이동 / 길게 누르거나 더블클릭 = 편집
 *   터치    탭 = 필터 / 길게 눌러 집어 든 뒤 끌기 = 순서 이동 / 길게 누르고 떼기 = 편집
 *
 * 터치에서만 길게 누르기를 요구하는 이유는 밴드가 가로 스크롤되기 때문이다.
 * 손가락을 바로 끌면 그건 스크롤이지 순서 이동이 아니다.
 * 마우스에는 그 충돌이 없다 — 스크롤은 휠로 한다. 그래서 곧바로 집어 든다.
 */
export function CategoryBand({
  categories,
  hiddenIds,
  showUncategorized,
  onToggle,
  onEdit,
  onAdd,
  onReorder,
}: Props) {
  const hidden = new Set(hiddenIds);

  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);

  const orderRef = useRef<string[] | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const pressTarget = useRef<{ el: HTMLButtonElement; pointerId: number } | null>(null);
  const pointerKind = useRef<string>("mouse");
  const armed = useRef(false); // 집어 들었는가
  const moved = useRef(false); // 집어 든 뒤 실제로 움직였는가

  const byId = new Map(categories.map((c) => [c.id, c]));

  // 드롭 직후 order를 곧바로 버리면, 낙관적 갱신이 캐시에 반영되기 전 한 프레임 동안
  // 옛 순서가 보인다. 그래서 유지하다가 목록 구성이 바뀌면(추가·삭제) 자동으로 버린다.
  const orderUsable =
    order !== null &&
    order.length === categories.length &&
    order.every((id) => byId.has(id));
  const displayed: Category[] = orderUsable
    ? order.map((id) => byId.get(id)!)
    : categories;

  function clearTimer() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  /** 칩을 집어 든다 */
  function arm(categoryId: string) {
    armed.current = true;
    const ids = displayedIds();
    orderRef.current = ids;
    dragIdRef.current = categoryId;
    setOrder(ids);
    setDragId(categoryId);

    const target = pressTarget.current;
    if (target) {
      try {
        target.el.setPointerCapture(target.pointerId);
      } catch {
        /* 캡처가 안 되어도 포인터가 칩 위에 있는 동안은 동작한다 */
      }
    }
  }

  function displayedIds(): string[] {
    return displayed.map((c) => c.id);
  }

  function startPress(category: Category, e: React.PointerEvent<HTMLButtonElement>) {
    armed.current = false;
    moved.current = false;
    pointerKind.current = e.pointerType;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTarget.current = { el: e.currentTarget, pointerId: e.pointerId };

    clearTimer();
    // 터치는 길게 눌러야 집어 들린다. 마우스는 움직이는 순간 집어 든다(movePress).
    // 길게 누르기 타이머 자체는 양쪽 모두에 걸어 편집 진입을 공통으로 만든다.
    pressTimer.current = setTimeout(() => arm(category.id), LONG_PRESS_MS);
  }

  function movePress(e: React.PointerEvent<HTMLButtonElement>) {
    const start = pressStart.current;
    if (!start) return;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);

    if (!armed.current) {
      if (dist <= MOVE_THRESHOLD) return;
      if (pointerKind.current === "touch") {
        // 집어 들기 전에 손가락이 움직였다 → 가로 스크롤이다
        clearTimer();
        pressStart.current = null;
        return;
      }
      // 마우스·펜은 곧바로 집어 든다
      clearTimer();
      const id = pressTargetCategoryId();
      if (!id) return;
      arm(id);
    }

    if (dist > MOVE_THRESHOLD) moved.current = true;
    reorderTo(e.clientX);
  }

  function pressTargetCategoryId(): string | null {
    const el = pressTarget.current?.el;
    if (!el) return null;
    for (const [id, node] of chipRefs.current) {
      if (node === el) return id;
    }
    return null;
  }

  /** 포인터 x좌표를 기준으로 끌고 있는 칩의 자리를 다시 잡는다 */
  function reorderTo(pointerX: number) {
    const ids = orderRef.current;
    const dragging = dragIdRef.current;
    if (!ids || !dragging) return;

    const from = ids.indexOf(dragging);
    if (from < 0) return;

    const rects = ids.map((id) => chipRefs.current.get(id)?.getBoundingClientRect());

    let to = ids.findIndex((_, i) => {
      const r = rects[i];
      return r ? pointerX < r.left + r.width / 2 : false;
    });
    if (to === -1) to = ids.length - 1;
    else if (to > from) to -= 1;
    if (to === from) return;

    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    orderRef.current = next;
    setOrder(next);
  }

  function finish() {
    clearTimer();
    pressStart.current = null;
    pressTarget.current = null;
    dragIdRef.current = null;
    setDragId(null);
  }

  function endPress(category: Category) {
    if (!armed.current) {
      finish();
      return; // 짧은 탭 → onClick이 필터를 토글한다
    }

    const ids = orderRef.current;
    if (moved.current && ids) {
      const changed = ids.some((id, i) => categories[i]?.id !== id);
      if (changed) onReorder(ids);
      // order는 남겨둔다 — 낙관적 갱신이 도착할 때까지 새 순서를 보여주기 위해
    } else {
      onEdit(category);
      setOrder(null);
    }

    orderRef.current = null;
    finish();
    // onClick이 뒤따라 오므로 다음 tick까지 armed를 유지해 필터 토글을 막는다
    setTimeout(() => {
      armed.current = false;
    }, 0);
  }

  function cancelPress() {
    clearTimer();
    armed.current = false;
    moved.current = false;
    orderRef.current = null;
    setOrder(null);
    finish();
  }

  return (
    <div
      className="flex flex-none gap-[6px] overflow-x-auto px-[14px] pb-[9px] pt-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ touchAction: dragId ? "none" : "pan-x" }}
      role="group"
      aria-label="카테고리 필터"
    >
      {displayed.map((c) => {
        const off = hidden.has(c.id);
        const tone = toneOf(c.color);
        const dragging = c.id === dragId;
        return (
          <button
            key={c.id}
            ref={(el) => {
              if (el) chipRefs.current.set(c.id, el);
              else chipRefs.current.delete(c.id);
            }}
            type="button"
            onPointerDown={(e) => startPress(c, e)}
            onPointerMove={movePress}
            onPointerUp={() => endPress(c)}
            onPointerCancel={cancelPress}
            // 마우스로 끌 때 브라우저 기본 드래그(고스트 이미지)가 끼어들지 않게.
            // pointerdown에서 preventDefault를 하면 click까지 막혀 필터 토글이 죽는다
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              if (armed.current) return;
              onToggle(c.id);
            }}
            onDoubleClick={() => onEdit(c)}
            aria-pressed={!off}
            title="탭: 필터 · 끌기: 순서 이동 · 길게 누르기: 편집"
            className="shrink-0 select-none overflow-hidden whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11px] font-bold"
            style={{
              // 켜진 칩은 카테고리 색을 그대로 채운다.
              // 밴드는 이 앱에서 색이 가장 크게 보이는 곳이라, 여기서 색을 못 읽으면
              // 카드 좌측 띠의 6px만으로 색과 이름을 잇게 된다.
              // 꺼진 칩은 회색 — 켜짐/꺼짐이 채도로 갈린다
              ...(off
                ? { background: "var(--line-2)", color: "var(--ink-3)" }
                : { background: tone.cp, color: "#ffffff" }),
              cursor: dragging ? "grabbing" : "grab",
              transform: dragging ? "scale(1.08)" : undefined,
              boxShadow: dragging ? "0 4px 12px rgba(0,0,0,0.28)" : undefined,
              opacity: dragId && !dragging ? 0.55 : 1,
              transition: dragging
                ? "transform 120ms var(--ease)"
                : "transform 160ms var(--ease), opacity 160ms var(--ease)",
              zIndex: dragging ? 1 : undefined,
            }}
          >
            {c.name}
          </button>
        );
      })}

      {showUncategorized && (
        <button
          type="button"
          onClick={() => onToggle(UNCATEGORIZED_ID)}
          aria-pressed={!hidden.has(UNCATEGORIZED_ID)}
          className="shrink-0 whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11px] font-bold"
          style={
            hidden.has(UNCATEGORIZED_ID)
              ? { background: "var(--line-2)", color: "var(--ink-3)" }
              : { background: toneOf(null).cp, color: "#ffffff" }
          }
        >
          {UNCATEGORIZED_NAME}
        </button>
      )}

      <button
        type="button"
        onClick={onAdd}
        aria-label="카테고리 추가"
        className="shrink-0 rounded-full px-[11px] py-[5px] text-[11px] font-bold"
        style={{ background: "var(--line-2)", color: "var(--ink-3)" }}
      >
        +
      </button>
    </div>
  );
}
