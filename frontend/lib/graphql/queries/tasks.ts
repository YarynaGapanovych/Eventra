export const TASKS_QUERY = `
  query Tasks {
    tasks {
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
