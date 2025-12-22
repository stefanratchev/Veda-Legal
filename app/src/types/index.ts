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
 * Subtopic within a topic category.
 */
export interface Subtopic {
  id: string;
  name: string;
  isPrefix: boolean;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
}

/**
 * Topic category containing subtopics.
 */
export interface Topic {
  id: string;
  name: string;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  subtopics: Subtopic[];
}

/**
 * Time entry with client and topic information.
 * Note: topicName and subtopicName are denormalized for immutability.
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
  subtopicId?: string | null;
  topicName: string;
  subtopicName: string;
}

/**
 * Form data for creating time entries.
 */
export interface FormData {
  clientId: string;
  subtopicId: string;
  hours: number;
  minutes: number;
  description: string;
}

/**
 * Initial form data state.
 */
export const initialFormData: FormData = {
  clientId: "",
  subtopicId: "",
  hours: 1,
  minutes: 0,
  description: "",
};
