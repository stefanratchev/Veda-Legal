import { pgTable, index, foreignKey, text, integer, numeric, timestamp, date, uniqueIndex, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql, relations } from "drizzle-orm"

export const clientStatus = pgEnum("ClientStatus", ['ACTIVE', 'INACTIVE'])
export const position = pgEnum("Position", ['ADMIN', 'PARTNER', 'SENIOR_ASSOCIATE', 'ASSOCIATE', 'CONSULTANT'])
export const practiceArea = pgEnum("PracticeArea", ['CORPORATE', 'FAMILY_LAW', 'IP_PATENT', 'REAL_ESTATE', 'LITIGATION', 'EMPLOYMENT', 'TAX', 'IMMIGRATION', 'CRIMINAL', 'OTHER'])
export const pricingMode = pgEnum("PricingMode", ['HOURLY', 'FIXED'])
export const serviceDescriptionStatus = pgEnum("ServiceDescriptionStatus", ['DRAFT', 'FINALIZED'])
export const subtopicStatus = pgEnum("SubtopicStatus", ['ACTIVE', 'INACTIVE'])
export const topicStatus = pgEnum("TopicStatus", ['ACTIVE', 'INACTIVE'])
export const userStatus = pgEnum("UserStatus", ['PENDING', 'ACTIVE', 'INACTIVE'])


export const serviceDescriptionTopics = pgTable("service_description_topics", {
	id: text().primaryKey().notNull(),
	serviceDescriptionId: text().notNull(),
	topicName: text().notNull(),
	displayOrder: integer().default(0).notNull(),
	pricingMode: pricingMode().default('HOURLY').notNull(),
	hourlyRate: numeric({ precision: 10, scale:  2 }),
	fixedFee: numeric({ precision: 10, scale:  2 }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("service_description_topics_serviceDescriptionId_idx").using("btree", table.serviceDescriptionId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.serviceDescriptionId],
			foreignColumns: [serviceDescriptions.id],
			name: "service_description_topics_serviceDescriptionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const serviceDescriptions = pgTable("service_descriptions", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	periodStart: date().notNull(),
	periodEnd: date().notNull(),
	status: serviceDescriptionStatus().default('DRAFT').notNull(),
	finalizedAt: timestamp({ precision: 3, mode: 'string' }),
	finalizedById: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("service_descriptions_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("service_descriptions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "service_descriptions_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.finalizedById],
			foreignColumns: [users.id],
			name: "service_descriptions_finalizedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const serviceDescriptionLineItems = pgTable("service_description_line_items", {
	id: text().primaryKey().notNull(),
	topicId: text().notNull(),
	timeEntryId: text(),
	date: date(),
	description: text().notNull(),
	hours: numeric({ precision: 4, scale:  2 }),
	fixedAmount: numeric({ precision: 10, scale:  2 }),
	displayOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("service_description_line_items_timeEntryId_idx").using("btree", table.timeEntryId.asc().nullsLast().op("text_ops")),
	index("service_description_line_items_topicId_idx").using("btree", table.topicId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [serviceDescriptionTopics.id],
			name: "service_description_line_items_topicId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.timeEntryId],
			foreignColumns: [timeEntries.id],
			name: "service_description_line_items_timeEntryId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	image: text(),
	status: userStatus().default('PENDING').notNull(),
	lastLogin: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	position: position().default('ASSOCIATE').notNull(),
}, (table) => [
	uniqueIndex("users_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const clients = pgTable("clients", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	invoicedName: text(),
	invoiceAttn: text(),
	email: text(),
	hourlyRate: numeric({ precision: 10, scale:  2 }),
	phone: text(),
	address: text(),
	practiceArea: practiceArea(),
	status: clientStatus().default('ACTIVE').notNull(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	secondaryEmails: text(),
});

export const topics = pgTable("topics", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	displayOrder: integer().default(0).notNull(),
	status: topicStatus().default('ACTIVE').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
});

export const subtopics = pgTable("subtopics", {
	id: text().primaryKey().notNull(),
	topicId: text().notNull(),
	name: text().notNull(),
	isPrefix: boolean().default(false).notNull(),
	displayOrder: integer().default(0).notNull(),
	status: subtopicStatus().default('ACTIVE').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("subtopics_topicId_idx").using("btree", table.topicId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "subtopics_topicId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const timeEntries = pgTable("time_entries", {
	id: text().primaryKey().notNull(),
	date: date().notNull(),
	hours: numeric({ precision: 4, scale:  2 }).notNull(),
	description: text().notNull(),
	userId: text().notNull(),
	clientId: text().notNull(),
	subtopicId: text(),
	topicName: text().default('').notNull(),
	subtopicName: text().default('').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("time_entries_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("time_entries_date_idx").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("time_entries_subtopicId_idx").using("btree", table.subtopicId.asc().nullsLast().op("text_ops")),
	index("time_entries_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "time_entries_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "time_entries_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.subtopicId],
			foreignColumns: [subtopics.id],
			name: "time_entries_subtopicId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
  finalizedServiceDescriptions: many(serviceDescriptions),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  timeEntries: many(timeEntries),
  serviceDescriptions: many(serviceDescriptions),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  subtopics: many(subtopics),
}));

export const subtopicsRelations = relations(subtopics, ({ one, many }) => ({
  topic: one(topics, {
    fields: [subtopics.topicId],
    references: [topics.id],
  }),
  timeEntries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [timeEntries.clientId],
    references: [clients.id],
  }),
  subtopic: one(subtopics, {
    fields: [timeEntries.subtopicId],
    references: [subtopics.id],
  }),
  billingLineItems: many(serviceDescriptionLineItems),
}));

export const serviceDescriptionsRelations = relations(serviceDescriptions, ({ one, many }) => ({
  client: one(clients, {
    fields: [serviceDescriptions.clientId],
    references: [clients.id],
  }),
  finalizedBy: one(users, {
    fields: [serviceDescriptions.finalizedById],
    references: [users.id],
  }),
  topics: many(serviceDescriptionTopics),
}));

export const serviceDescriptionTopicsRelations = relations(serviceDescriptionTopics, ({ one, many }) => ({
  serviceDescription: one(serviceDescriptions, {
    fields: [serviceDescriptionTopics.serviceDescriptionId],
    references: [serviceDescriptions.id],
  }),
  lineItems: many(serviceDescriptionLineItems),
}));

export const serviceDescriptionLineItemsRelations = relations(serviceDescriptionLineItems, ({ one }) => ({
  topic: one(serviceDescriptionTopics, {
    fields: [serviceDescriptionLineItems.topicId],
    references: [serviceDescriptionTopics.id],
  }),
  timeEntry: one(timeEntries, {
    fields: [serviceDescriptionLineItems.timeEntryId],
    references: [timeEntries.id],
  }),
}));
