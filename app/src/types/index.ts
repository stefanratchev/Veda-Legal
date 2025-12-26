/**
 * Shared type definitions for the Veda Legal Timesheets application.
 */

/**
 * Client for timesheet selection (minimal fields).
 */
export interface Client {
  id: string;
  name: string;
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
  };
  subtopicId?: string | null;
  topicName: string;
  subtopicName: string;
}

/**
 * Summary of an employee's time entries for team view.
 */
export interface TeamSummary {
  userId: string;
  userName: string;
  position: string;
  totalHours: number;
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

/**
 * Service description status.
 */
export type ServiceDescriptionStatus = "DRAFT" | "FINALIZED";

/**
 * Pricing mode for a topic.
 */
export type PricingMode = "HOURLY" | "FIXED";

/**
 * Line item in a service description topic.
 */
export interface ServiceDescriptionLineItem {
  id: string;
  timeEntryId: string | null;
  date: string | null;
  description: string;
  hours: number | null;
  fixedAmount: number | null;
  displayOrder: number;
  // Original values from TimeEntry (for showing changes)
  originalDescription?: string;
  originalHours?: number;
}

/**
 * Topic section in a service description.
 */
export interface ServiceDescriptionTopic {
  id: string;
  topicName: string;
  displayOrder: number;
  pricingMode: PricingMode;
  hourlyRate: number | null;
  fixedFee: number | null;
  lineItems: ServiceDescriptionLineItem[];
}

/**
 * Service description for billing.
 */
export interface ServiceDescription {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    invoicedName: string | null;
    invoiceAttn: string | null;
    hourlyRate: number | null;
  };
  periodStart: string;
  periodEnd: string;
  status: ServiceDescriptionStatus;
  finalizedAt: string | null;
  topics: ServiceDescriptionTopic[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Service description list item (without nested topics).
 */
export interface ServiceDescriptionListItem {
  id: string;
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  status: ServiceDescriptionStatus;
  totalAmount: number;
  updatedAt: string;
}

// M365 Activity types
export type {
  M365CalendarEvent,
  M365Email,
  M365ActivityResponse,
  M365ActivityError,
} from "./m365";
