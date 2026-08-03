"use client";

import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { CategoryBand } from "@/components/category/CategoryBand";
import { CategoryEditSheet } from "@/components/category/CategoryEditSheet";
import { QuickAddBar } from "@/components/input/QuickAddBar";
import { SettingsSheet } from "@/components/SettingsSheet";
import { MigrationPrompt } from "@/components/MigrationPrompt";
import { SyncBadge } from "@/components/sync/SyncBadge";
import { OverdueFold } from "@/components/task/OverdueFold";
import { TaskEditSheet, type TaskDraft } from "@/components/task/TaskEditSheet";
import { TaskList } from "@/components/task/TaskList";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  countTasksIn,
  hasUncategorized,
  usedColors,
} from "@/domain/category";
import {
  addMonths,
  formatDayShort,
  formatMonthTitle,
  monthOf,
} from "@/domain/date";
import { suggestColor } from "@/domain/palette";
import { filterTasks, tasksOnDate } from "@/domain/task";
import type { Category, CategoryDeleteMode, PaletteKey, Task } from "@/domain/types";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryMutations } from "@/hooks/useCategoryMutations";
import { useOverdueTasks } from "@/hooks/useOverdueTasks";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useTasks } from "@/hooks/useTasks";
import { useToday } from "@/hooks/useToday";
import { useUiStore } from "@/stores/uiStore";

export function AppShell() {
  const storedDate = useUiStore((s) => s.selectedDate);
  const storedMonth = useUiStore((s) => s.visibleMonth);
  const selectDate = useUiStore((s) => s.selectDate);
  const goToMonth = useUiStore((s) => s.goToMonth);
  const goToToday = useUiStore((s) => s.goToToday);
  const hiddenCategoryIds = useUiStore((s) => s.hiddenCategoryIds);
  const toggleCategory = useUiStore((s) => s.toggleCategory);
  const hideCompleted = useUiStore((s) => s.hideCompleted);
  const setHideCompleted = useUiStore((s) => s.setHideCompleted);
  const overdueOpen = useUiStore((s) => s.overdueOpen);
  const toggleOverdue = useUiStore((s) => s.toggleOverdue);

  const today = useToday();

  // 사용자가 고르기 전에는 오늘로 대체한다.
  // 저장하지 않으므로 앱을 다시 열면 자동으로 오늘로 돌아온다 (P2)
  const selectedDate = storedDate ?? today;
  const visibleMonth = storedMonth ?? (today ? monthOf(today) : null);

  const { categories } = useCategories();
  const { tasks } = useTasks(visibleMonth);
  const { overdue } = useOverdueTasks(today);
  const { createTask, updateTask, deleteTask, toggle, moveToToday } =
    useTaskMutations();
  const { pending, lastError, dismissError } = useSyncQueue();
  const {
    createCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
    reorderCategories,
  } = useCategoryMutations(categories);

  // 마지막으로 쓴 카테고리가 다음 입력의 기본값이 된다 (E1)
  const [lastCategoryId, setLastCategoryId] = useState<string | null>(null);
  const activeCategoryId = useMemo(() => {
    if (lastCategoryId && categories.some((c) => c.id === lastCategoryId)) {
      return lastCategoryId;
    }
    return categories[0]?.id ?? null;
  }, [lastCategoryId, categories]);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [taskSheetKey, setTaskSheetKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categorySheetKey, setCategorySheetKey] = useState(0);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // 필터는 달력과 리스트에 똑같이 적용된다
  const calendarTasks = useMemo(
    () => filterTasks(tasks, { hiddenCategoryIds, hideCompleted }),
    [tasks, hiddenCategoryIds, hideCompleted],
  );
  const listTasks = useMemo(
    () =>
      selectedDate
        ? filterTasks(tasks, { hiddenCategoryIds, hideCompleted, on: selectedDate })
        : [],
    [tasks, hiddenCategoryIds, hideCompleted, selectedDate],
  );
  // 밀린 할일에도 카테고리 필터는 적용한다. 완료 숨기기는 의미가 없다(전부 미완료)
  const overdueVisible = useMemo(
    () => filterTasks(overdue, { hiddenCategoryIds, hideCompleted: false }),
    [overdue, hiddenCategoryIds],
  );

  if (!today || !selectedDate || !visibleMonth) {
    // 마운트 전에는 구조만 유지한 빈 껍데기. 스피너로 화면을 막지 않는다
    return <div className="flex-1" aria-hidden />;
  }

  const isToday = selectedDate === today;
  const dayList = tasksOnDate(listTasks, selectedDate);

  function openNewTask(title: string) {
    setEditingTask(null);
    setTaskDraft({
      title,
      categoryId: activeCategoryId,
      startDate: selectedDate!,
      endDate: selectedDate!,
      checkMode: "once",
    });
    setTaskSheetKey((k) => k + 1);
    setTaskSheetOpen(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskDraft({
      title: task.title,
      categoryId: task.categoryId,
      startDate: task.startDate,
      endDate: task.endDate,
      checkMode: task.checkMode,
    });
    setTaskSheetKey((k) => k + 1);
    setTaskSheetOpen(true);
  }

  function saveTask(draft: TaskDraft) {
    if (editingTask) {
      // completedDates는 건드리지 않는다.
      // daily → once 로 바꿔도 보관해 두어야 되돌렸을 때 복원된다 (요구사항 4.4.1)
      updateTask(editingTask.id, {
        title: draft.title,
        categoryId: draft.categoryId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        checkMode: draft.checkMode,
      });
    } else {
      createTask({
        title: draft.title,
        categoryId: draft.categoryId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        checkMode: draft.checkMode,
      });
    }
    if (draft.categoryId) setLastCategoryId(draft.categoryId);
    setTaskSheetOpen(false);
    setEditingTask(null);
  }

  function openCategory(category: Category | null) {
    setEditingCategory(category);
    setCategorySheetKey((k) => k + 1);
    setCategorySheetOpen(true);
  }

  function saveCategory(name: string, color: PaletteKey) {
    if (editingCategory) {
      if (name !== editingCategory.name) renameCategory(editingCategory.id, name);
      // 색은 미리보기 단계에서 이미 반영됐다
    } else {
      createCategory(name, color);
    }
    setCategorySheetOpen(false);
    setEditingCategory(null);
  }

  function removeCategory(mode: CategoryDeleteMode) {
    if (editingCategory) deleteCategory(editingCategory.id, mode);
    setCategorySheetOpen(false);
    setEditingCategory(null);
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[520px] flex-col">
      <header className="flex flex-none items-center justify-between px-[15px] pb-[7px] pt-[9px]">
        <div className="flex items-center gap-[6px]">
          <h1 className="text-[17px] font-bold tracking-tight">
            {formatMonthTitle(visibleMonth)}
          </h1>
          {/* 데스크톱에는 스와이프가 없다 */}
          <div className="flex items-center text-ink-3">
            <button
              type="button"
              onClick={() => goToMonth(addMonths(visibleMonth, -1))}
              aria-label="이전 달"
              className="px-[6px] py-[2px] text-[13px]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goToMonth(addMonths(visibleMonth, 1))}
              aria-label="다음 달"
              className="px-[6px] py-[2px] text-[13px]"
            >
              ›
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              type="button"
              onClick={() => goToToday(today)}
              className="rounded-full bg-line-2 px-[10px] py-[4px] text-[11px] text-ink-2"
            >
              오늘
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="설정"
            className="px-1 text-[15px] text-ink-3"
          >
            ⚙
          </button>
        </div>
      </header>

      <CategoryBand
        categories={categories}
        hiddenIds={hiddenCategoryIds}
        showUncategorized={hasUncategorized(tasks)}
        onToggle={toggleCategory}
        onEdit={openCategory}
        onAdd={() => openCategory(null)}
        onReorder={reorderCategories}
      />

      <MonthCalendar
        month={visibleMonth}
        today={today}
        selectedDate={selectedDate}
        tasks={calendarTasks}
        categories={categories}
        onSelect={selectDate}
        onShiftMonth={(delta) => goToMonth(addMonths(visibleMonth, delta))}
      />

      {/* 밀린 할일은 오늘을 보고 있을 때만 (E5). 동기화 표식도 여기 자리한다 */}
      {isToday ? (
        <div className="pt-[8px]">
          <OverdueFold
            tasks={overdueVisible}
            categories={categories}
            open={overdueOpen}
            today={today}
            onToggleOpen={toggleOverdue}
            onMoveToToday={(task) => moveToToday(task, today)}
            onOpen={openEditTask}
            rightSlot={<SyncBadge pending={pending} />}
          />
        </div>
      ) : (
        pending > 0 && (
          <div className="flex flex-none justify-end px-[15px] pt-[6px]">
            <SyncBadge pending={pending} />
          </div>
        )
      )}

      <div className="flex flex-none items-center justify-between px-[15px] pb-[5px] pt-[11px] text-[11px] text-ink-3">
        <span>
          {formatDayShort(selectedDate)}
          {isToday && " · 오늘"}
        </span>
        <span>{dayList.length}개</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TaskList
          date={selectedDate}
          tasks={listTasks}
          categories={categories}
          hasAnyTask={tasks.length > 0}
          onToggle={(task) => toggle(task, selectedDate)}
          onOpen={openEditTask}
          onRequestDelete={setPendingDelete}
        />
      </div>

      <QuickAddBar
        date={selectedDate}
        isToday={isToday}
        categories={categories}
        categoryId={activeCategoryId}
        onCategoryChange={setLastCategoryId}
        onSubmit={(title) =>
          createTask({
            title,
            categoryId: activeCategoryId,
            startDate: selectedDate,
          })
        }
        onOpenDetail={openNewTask}
      />

      {taskDraft && (
        <TaskEditSheet
          key={taskSheetKey}
          open={taskSheetOpen}
          task={editingTask}
          initial={taskDraft}
          categories={categories}
          onClose={() => {
            setTaskSheetOpen(false);
            setEditingTask(null);
          }}
          onSave={saveTask}
          onDelete={(task) => {
            setTaskSheetOpen(false);
            setEditingTask(null);
            setPendingDelete(task);
          }}
        />
      )}

      <CategoryEditSheet
        key={categorySheetKey}
        open={categorySheetOpen}
        category={editingCategory}
        taskCount={editingCategory ? countTasksIn(tasks, editingCategory.id) : 0}
        usedColors={usedColors(categories)}
        suggestedColor={suggestColor(usedColors(categories))}
        onClose={() => {
          setCategorySheetOpen(false);
          setEditingCategory(null);
        }}
        onPreviewColor={(color) =>
          editingCategory && recolorCategory(editingCategory.id, color)
        }
        onSave={saveCategory}
        onDelete={removeCategory}
      />

      <SettingsSheet
        open={settingsOpen}
        hideCompleted={hideCompleted}
        onHideCompletedChange={setHideCompleted}
        onClose={() => setSettingsOpen(false)}
      />

      <MigrationPrompt />

      {/* 최종 실패는 숨기지 않는다 (요구사항 F6-9). 화면은 이미 서버 상태로 되돌아간 뒤다 */}
      {lastError && (
        <div className="fixed inset-x-0 bottom-0 z-[65] mx-auto max-w-[520px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div
            role="alert"
            className="flex items-center gap-3 rounded-[12px] px-[14px] py-[11px] text-[12.5px]"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            <span className="flex-1">동기화에 실패했습니다 — {lastError}</span>
            <button type="button" onClick={dismissError} className="shrink-0 underline">
              닫기
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="할일을 삭제할까요?"
        description={pendingDelete?.title}
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          if (pendingDelete) deleteTask(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
