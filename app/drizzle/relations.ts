import { relations } from "drizzle-orm/relations";
import { serviceDescriptions, serviceDescriptionTopics, clients, users, serviceDescriptionLineItems, timeEntries, topics, subtopics } from "../src/lib/schema";

export const serviceDescriptionTopicsRelations = relations(serviceDescriptionTopics, ({one, many}) => ({
	serviceDescription: one(serviceDescriptions, {
		fields: [serviceDescriptionTopics.serviceDescriptionId],
		references: [serviceDescriptions.id]
	}),
	serviceDescriptionLineItems: many(serviceDescriptionLineItems),
}));

export const serviceDescriptionsRelations = relations(serviceDescriptions, ({one, many}) => ({
	serviceDescriptionTopics: many(serviceDescriptionTopics),
	client: one(clients, {
		fields: [serviceDescriptions.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [serviceDescriptions.finalizedById],
		references: [users.id]
	}),
}));

export const clientsRelations = relations(clients, ({many}) => ({
	serviceDescriptions: many(serviceDescriptions),
	timeEntries: many(timeEntries),
}));

export const usersRelations = relations(users, ({many}) => ({
	serviceDescriptions: many(serviceDescriptions),
	timeEntries: many(timeEntries),
}));

export const serviceDescriptionLineItemsRelations = relations(serviceDescriptionLineItems, ({one}) => ({
	serviceDescriptionTopic: one(serviceDescriptionTopics, {
		fields: [serviceDescriptionLineItems.topicId],
		references: [serviceDescriptionTopics.id]
	}),
	timeEntry: one(timeEntries, {
		fields: [serviceDescriptionLineItems.timeEntryId],
		references: [timeEntries.id]
	}),
}));

export const timeEntriesRelations = relations(timeEntries, ({one, many}) => ({
	serviceDescriptionLineItems: many(serviceDescriptionLineItems),
	user: one(users, {
		fields: [timeEntries.userId],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [timeEntries.clientId],
		references: [clients.id]
	}),
	subtopic: one(subtopics, {
		fields: [timeEntries.subtopicId],
		references: [subtopics.id]
	}),
}));

export const subtopicsRelations = relations(subtopics, ({one, many}) => ({
	topic: one(topics, {
		fields: [subtopics.topicId],
		references: [topics.id]
	}),
	timeEntries: many(timeEntries),
}));

export const topicsRelations = relations(topics, ({many}) => ({
	subtopics: many(subtopics),
}));