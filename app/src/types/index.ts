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
}

/**
 * Form data for creating/editing time entries.
 */
export interface FormData {
  clientId: string;
  hours: number;
  minutes: number;
  description: string;
}

/**
 * Initial form data state.
 */
export const initialFormData: FormData = {
  clientId: "",
  hours: 1,
  minutes: 0,
  description: "",
};
