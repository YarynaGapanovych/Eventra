export const ASSISTANT_THREAD_QUERY = `
  query AssistantThread {
    assistantThread {
      expiresAt
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;
