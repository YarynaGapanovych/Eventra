import { TASK_SELECTION } from "@/lib/graphql/fragments";

export const CREATE_TASK_MUTATION = `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ${TASK_SELECTION}
    }
  }
`;
