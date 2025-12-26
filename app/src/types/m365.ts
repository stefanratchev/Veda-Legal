// src/types/m365.ts

/**
 * Calendar event from Microsoft 365.
 */
export interface M365CalendarEvent {
  subject: string;
  start: string; // ISO timestamp
  durationMinutes: number;
  attendees: string[]; // Display names or emails
}

/**
 * Email from Microsoft 365.
 */
export interface M365Email {
  subject: string;
  timestamp: string; // ISO timestamp
  from: string; // Sender
  to: string[]; // Recipients
  direction: "sent" | "received";
}

/**
 * Response from /api/m365/activity endpoint.
 */
export interface M365ActivityResponse {
  calendar: M365CalendarEvent[];
  emails: M365Email[];
}

/**
 * Error response from /api/m365/activity endpoint.
 */
export interface M365ActivityError {
  error: string;
  code?: "SESSION_EXPIRED" | "GRAPH_ERROR" | "NETWORK_ERROR";
}
