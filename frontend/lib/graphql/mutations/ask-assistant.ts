export const ASK_ASSISTANT_MUTATION = `
  mutation AskAssistant($messages: [AssistantMessageInput!]!) {
    askAssistant(messages: $messages) {
      content
      didMutate
    }
  }
`;
