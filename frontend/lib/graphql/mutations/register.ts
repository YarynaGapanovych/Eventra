export const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      user {
        id
        email
        name
      }
    }
  }
`;
