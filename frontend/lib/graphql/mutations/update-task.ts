import { TASK_SELECTION } from "@/lib/graphql/fragments";

export const UPDATE_TASK_MUTATION = `
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ${TASK_SELECTION}
    }
  }
`;
