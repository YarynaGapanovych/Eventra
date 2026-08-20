export const SCHEDULE_TASK_MUTATION = `
  mutation ScheduleTask($input: ScheduleTaskInput!) {
    scheduleTask(input: $input) {
      id
      title
      start
      end
      source
      googleEventId
      taskId
    }
  }
`;
