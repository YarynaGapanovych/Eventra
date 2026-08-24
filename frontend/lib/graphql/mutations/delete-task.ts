export const DELETE_TASK_MUTATION = `
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
  }
`;
