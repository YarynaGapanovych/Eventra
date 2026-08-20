import { EVENT_SELECTION } from "@/lib/graphql/fragments";

export const SCHEDULE_TASK_MUTATION = `
  mutation ScheduleTask($input: ScheduleTaskInput!) {
    scheduleTask(input: $input) {
      ${EVENT_SELECTION}
    }
  }
`;
