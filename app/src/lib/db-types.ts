import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  clients,
  topics,
  subtopics,
  timeEntries,
  serviceDescriptions,
  serviceDescriptionTopics,
  serviceDescriptionLineItems,
} from './schema';

// Select types (for reading from DB)
export type User = InferSelectModel<typeof users>;
export type Client = InferSelectModel<typeof clients>;
export type Topic = InferSelectModel<typeof topics>;
export type Subtopic = InferSelectModel<typeof subtopics>;
export type TimeEntry = InferSelectModel<typeof timeEntries>;
export type ServiceDescription = InferSelectModel<typeof serviceDescriptions>;
export type ServiceDescriptionTopic = InferSelectModel<typeof serviceDescriptionTopics>;
export type ServiceDescriptionLineItem = InferSelectModel<typeof serviceDescriptionLineItems>;

// Insert types (for writing to DB)
export type NewUser = InferInsertModel<typeof users>;
export type NewClient = InferInsertModel<typeof clients>;
export type NewTopic = InferInsertModel<typeof topics>;
export type NewSubtopic = InferInsertModel<typeof subtopics>;
export type NewTimeEntry = InferInsertModel<typeof timeEntries>;
export type NewServiceDescription = InferInsertModel<typeof serviceDescriptions>;
export type NewServiceDescriptionTopic = InferInsertModel<typeof serviceDescriptionTopics>;
export type NewServiceDescriptionLineItem = InferInsertModel<typeof serviceDescriptionLineItems>;
