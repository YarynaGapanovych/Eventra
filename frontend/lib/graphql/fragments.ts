export const CALENDAR_DETAILS_SELECTION = `
  location
  description
  allDay
  timezone
  recurrence
  busy
  visibility
  conferenceUrl
  guestCanModify
  guestCanInvite
  guestCanSeeOthers
  guests {
    id
    email
    name
    response
  }
  reminders {
    id
    minutesBefore
  }
`;

export const EVENT_SELECTION = `
  id
  title
  start
  end
  source
  googleEventId
  color
  taskId
  ${CALENDAR_DETAILS_SELECTION}
`;

export const TASK_SELECTION = `
  id
  name
  progressStatus
  status
  priority
  deadline
  areaId
  start
  end
  color
  ${CALENDAR_DETAILS_SELECTION}
  employees {
    id
    name
  }
  events {
    ${EVENT_SELECTION}
  }
`;
