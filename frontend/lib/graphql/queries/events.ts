export const EVENTS_QUERY = `
  query Events {
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
`;
