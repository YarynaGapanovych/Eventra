"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ApiTask,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

function priorityClass(p: ApiTask["priority"]) {
  if (p === "high")
    return "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200";
  if (p === "medium")
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

type Props = {
  tasks: ApiTask[];
  onEdit: (task: ApiTask) => void;
};

export function TasksListView({ tasks, onEdit }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "deadline", desc: false },
  ]);

  const columns = useMemo<ColumnDef<ApiTask>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto gap-1 px-0 py-0 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-transparent hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.events.length > 0 ? (
              <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {row.original.events.length} block
                {row.original.events.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        sortingFn: (rowA, rowB) => {
          const rank = { high: 0, medium: 1, low: 2 } as const;
          return rank[rowA.original.priority] - rank[rowB.original.priority];
        },
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto gap-1 px-0 py-0 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-transparent hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Priority
            <ArrowUpDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              priorityClass(row.original.priority),
            )}
          >
            {TASK_PRIORITY_LABELS[row.original.priority]}
          </span>
        ),
      },
      {
        accessorKey: "status",
        sortingFn: (rowA, rowB) => {
          const rank = { todo: 0, in_progress: 1, done: 2 } as const;
          return rank[rowA.original.status] - rank[rowB.original.status];
        },
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto gap-1 px-0 py-0 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-transparent hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => TASK_STATUS_LABELS[row.original.status],
      },
      {
        accessorKey: "deadline",
        sortingFn: (rowA, rowB) => {
          const am = rowA.original.deadline
            ? dayjs(rowA.original.deadline).valueOf()
            : Number.POSITIVE_INFINITY;
          const bm = rowB.original.deadline
            ? dayjs(rowB.original.deadline).valueOf()
            : Number.POSITIVE_INFINITY;
          return am - bm;
        },
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto gap-1 px-0 py-0 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-transparent hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Deadline
            <ArrowUpDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-zinc-600 dark:text-zinc-400">
            {row.original.deadline
              ? dayjs(row.original.deadline).format("MMM D, YYYY HH:mm")
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="block text-right">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onEdit(row.original)}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [onEdit],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- shadcn data-table pattern uses TanStack's table instance
  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/80 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <Table className="min-w-[620px]">
        <TableHeader>
          <TableRow className="bg-zinc-50/90 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:bg-zinc-50/90 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-900/50">
            {table.getHeaderGroups().map((group) =>
              group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.id === "actions" ? "px-4 py-3 text-right" : "px-4 py-3"}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              )),
            )}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="text-zinc-800 dark:text-zinc-200">
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.id === "actions" ? "px-4 py-3 text-right" : "px-4 py-3"}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
