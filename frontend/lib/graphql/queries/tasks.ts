import { TASK_SELECTION } from "@/lib/graphql/fragments";

export const TASKS_QUERY = `
  query Tasks {
    tasks {
      ${TASK_SELECTION}
    }
  }
`;
