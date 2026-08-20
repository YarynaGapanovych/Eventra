export const UPDATE_TASK_MUTATION = `
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      name
      progressStatus
      status
      priority
      deadline
      areaId
      employees {
        id
        name
      }
      events {
        id
        title
        start
        end
        source
        googleEventId
        color
        taskId
      }
    }
  }
`;
