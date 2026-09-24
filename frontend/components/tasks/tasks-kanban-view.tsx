"use client";

import {
  closestCorners,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ApiTask,
  type TaskBoardStatus,
  TASK_BOARD_STATUSES,
} from "@/lib/tasks-api";
import dayjs from "dayjs";
import { GripVertical } from "lucide-react";

function priorityAccent(p: ApiTask["priority"]) {
  if (p === "high") return "border-l-red-500";
  if (p === "medium") return "border-l-amber-500";
  return "border-l-zinc-400";
}

function KanbanCard({
  task,
  onEdit,
}: {
  task: ApiTask;
  onEdit: (t: ApiTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style =
    transform != null
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-3 flex rounded-lg border border-l-4 border-zinc-200 bg-white shadow-sm transition-shadow dark:border-zinc-700 dark:bg-zinc-950",
        priorityAccent(task.priority),
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-l-md border border-transparent p-2 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800/80"
        aria-label={`Drag ${task.name}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="size-4 shrink-0" aria-hidden />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-stretch rounded-r-md py-2 pr-3 pl-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/80"
        onClick={() => onEdit(task)}
      >
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          {task.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {task.events.length > 0 ? (
            <>
              <span>
                {task.events.length} block
                {task.events.length === 1 ? "" : "s"}
              </span>
              <span aria-hidden>·</span>
            </>
          ) : (
            <>
              <span>Unscheduled</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{TASK_PRIORITY_LABELS[task.priority]}</span>
          <span aria-hidden>·</span>
          <span>
            {task.deadline
              ? `Due ${dayjs(task.deadline).format("MMM D")}`
              : "No deadline"}
          </span>
        </div>
      </button>
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  onEdit,
}: {
  status: TaskBoardStatus;
  tasks: ApiTask[];
  onEdit: (t: ApiTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section className="flex min-h-[280px] min-w-[240px] flex-1 flex-col rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col p-3",
          isOver && "rounded-b-xl bg-teal-50/60 ring-2 ring-inset ring-teal-400/40 dark:bg-teal-950/25",
        )}
      >
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

function resolveDropStatus(
  overId: string,
  tasks: ApiTask[],
): TaskBoardStatus | null {
  if (TASK_BOARD_STATUSES.includes(overId as TaskBoardStatus)) {
    return overId as TaskBoardStatus;
  }
  const nested = tasks.find((t) => t.id === overId);
  return nested?.status ?? null;
}

type Props = {
  tasks: ApiTask[];
  onEdit: (task: ApiTask) => void;
  onMove: (taskId: string, status: TaskBoardStatus) => Promise<void>;
};

export function TasksKanbanView({ tasks, onEdit, onMove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  );

  async function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over) return;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const next = resolveDropStatus(String(over.id), tasks);
    if (!next || next === task.status) return;

    await onMove(taskId, next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(e) => void handleDragEnd(e)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {TASK_BOARD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DndContext>
  );
}
