/**
 * Shared type definitions for the Veda Legal Timesheets application.
 */

/**
 * Client for timesheet selection (minimal fields).
 */
export interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

/**
 * Topic for categorizing time entries.
 */
export interface Topic {
  id: string;
  name: string;
  code: string;
}

/**
 * Time entry with client information.
 */
export interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
  topicId?: string | null;
  topic?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * Form data for creating/editing time entries.
 */
export interface FormData {
  clientId: string;
  topicId: string;
  hours: number;
  minutes: number;
  description: string;
}

/**
 * Initial form data state.
 */
export const initialFormData: FormData = {
  clientId: "",
  topicId: "",
  hours: 1,
  minutes: 0,
  description: "",
};
