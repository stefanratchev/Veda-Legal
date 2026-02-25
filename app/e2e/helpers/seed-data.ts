// Deterministic test data constants.
// IDs are hardcoded cuid2-format strings so they're consistent across processes
// (global-setup seeds these into the DB, test specs reference them for assertions).

export const TEST_USER = {
  id: "e2e_user_elena_petrova01",
  email: "test@vedalegal.bg",
  name: "Elena Petrova",
  position: "ADMIN" as const,
  status: "ACTIVE" as const,
};

export const CLIENTS = {
  regular: {
    id: "e2e_client_balkanova_01",
    name: "Balkanova Industries",
    clientType: "REGULAR" as const,
    status: "ACTIVE" as const,
  },
  internal: {
    id: "e2e_client_internal_01",
    name: "Veda Legal (Internal)",
    clientType: "INTERNAL" as const,
    status: "ACTIVE" as const,
  },
} as const;

export const TOPICS = {
  corporate: {
    id: "e2e_topic_corporate_01",
    name: "Corporate Advisory",
    topicType: "REGULAR" as const,
    status: "ACTIVE" as const,
    displayOrder: 1,
  },
  firmAdmin: {
    id: "e2e_topic_firm_admin_01",
    name: "Firm Administration",
    topicType: "INTERNAL" as const,
    status: "ACTIVE" as const,
    displayOrder: 2,
  },
} as const;

export const SUBTOPICS = {
  correspondence: {
    id: "e2e_sub_correspondence1",
    topicId: TOPICS.corporate.id,
    name: "Client correspondence:",
    isPrefix: true,
    displayOrder: 1,
    status: "ACTIVE" as const,
  },
  draftingShareholder: {
    id: "e2e_sub_shareholder_01",
    topicId: TOPICS.corporate.id,
    name: "Drafting shareholder agreement",
    isPrefix: false,
    displayOrder: 2,
    status: "ACTIVE" as const,
  },
  legalResearch: {
    id: "e2e_sub_legal_resrch01",
    topicId: TOPICS.corporate.id,
    name: "Legal research:",
    isPrefix: true,
    displayOrder: 3,
    status: "ACTIVE" as const,
  },
} as const;
