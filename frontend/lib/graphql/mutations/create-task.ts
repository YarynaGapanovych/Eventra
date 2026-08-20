export const CREATE_TASK_MUTATION = `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
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
        taskId
      }
    }
  }
`;
