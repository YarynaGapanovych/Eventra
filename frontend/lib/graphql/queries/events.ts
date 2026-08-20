import { EVENT_SELECTION } from "@/lib/graphql/fragments";

export const EVENTS_QUERY = `
  query Events {
    events {
      ${EVENT_SELECTION}
    }
  }
`;
