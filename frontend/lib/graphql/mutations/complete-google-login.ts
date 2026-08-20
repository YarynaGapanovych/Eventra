export const COMPLETE_GOOGLE_LOGIN_MUTATION = `
  mutation CompleteGoogleLogin($code: String!) {
    completeGoogleLogin(code: $code) {
      accessToken
      user {
        id
        email
        name
      }
    }
  }
`;
