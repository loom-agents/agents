import { Agent } from "../Agent";

// Simulate fetching calendar events from a database
function fetchCalendarEvents(date: string) {
  return [
    {
      title: "Meeting with Jane",
      date: date,
      time: "10:00",
      duration: "1 hour",
    },
    {
      title: "Lunch with Alex",
      date: date,
      time: "12:00",
      duration: "1 hour",
    },
  ];
}

// Simulate adding a new event to the calendar
function addCalendarEvent(event: any) {
  console.log("Added event:", event);
  return "Event added successfully";
}

// Simulate fetching unread emails from a server
function fetchUnreadEmails() {
  return [
    {
      sender: "John Doe",
      subject: "Meeting Follow-Up",
      date: "2022-01-01",
    },
    {
      sender: "Jane Smith",
      subject: "Lunch Invitation",
      date: "2022-01-02",
    },
  ];
}

async function main() {
  // Create specialized capability agents
  const calendarAgent = new Agent({
    name: "Calendar Agent",
    purpose: "Manage calendar events and scheduling",
    tools: [
      {
        name: "GetEvents",
        description: "Get events for a specific date",
        parameters: { date: { type: "string" } },
        callback: (args) => fetchCalendarEvents(args.date),
      },
      {
        name: "AddEvent",
        description: "Add a new event to the calendar",
        parameters: {
          title: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          duration: { type: "string" },
        },
        callback: (args) => addCalendarEvent(args),
      },
    ],
  });

  const emailAgent = new Agent({
    name: "Email Agent",
    purpose: "Draft and summarize emails",
    tools: [
      {
        name: "GetUnreadEmails",
        description: "Get unread emails",
        parameters: {},
        callback: () => fetchUnreadEmails(),
      },
    ],
  });

  const weatherAgent = new Agent({
    name: "Weather Agent",
    purpose: "Get current and forecasted weather information for Seattle",
    web_search: {
      enabled: true,
    },
  });

  // Create a personal assistant that uses all these capabilities
  const personalAssistant = new Agent({
    name: "Personal Assistant",
    purpose: "Help the user manage their day",
    sub_agents: [calendarAgent, emailAgent, weatherAgent],
  });

  // The assistant can now orchestrate multiple tasks with a single request
  const morningBriefing = await personalAssistant.run(
    "Give me my morning briefing including today's calendar, unread emails, and weather forecast"
  );
  console.log(morningBriefing);
}

main().catch(console.error);
