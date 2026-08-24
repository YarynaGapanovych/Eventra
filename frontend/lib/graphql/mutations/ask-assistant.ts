export const ASK_ASSISTANT_MUTATION = `
  mutation AskAssistant($content: String!) {
    askAssistant(content: $content) {
      content
      didMutate
    }
  }
`;
