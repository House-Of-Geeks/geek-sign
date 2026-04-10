import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// NextAuth required tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  plan: text("plan").default("free").notNull(),
  companyName: text("company_name"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  // Custom branding (Starter+ plans)
  brandingLogoUrl: text("branding_logo_url"),
  brandingPrimaryColor: text("branding_primary_color"),
  // Saved signature for quick re-use during signing
  savedSignature: text("saved_signature"),
  savedInitials: text("saved_initials"),
  // Custom sender display name for outgoing signature request emails
  sendAsName: text("send_as_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Application tables
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamInvitations = pgTable("team_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  token: uuid("token").defaultRandom().notNull(),
  status: text("status").default("pending").notNull(), // pending, accepted, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id),
  title: text("title").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  pageCount: integer("page_count"),
  status: text("status").default("draft").notNull(),
  customMessage: text("custom_message"),
  // Document integrity - SHA-256 hash of original PDF
  documentHash: text("document_hash"),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipients = pgTable("recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  orderIndex: integer("order_index").default(0).notNull(),
  status: text("status").default("pending").notNull(),
  signingToken: uuid("signing_token").defaultRandom().notNull(),
  signedAt: timestamp("signed_at"),
  viewedAt: timestamp("viewed_at"),
  ipAddress: text("ip_address"),
  // ESIGN Act compliance - consent tracking
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  consentIpAddress: text("consent_ip_address"),
  // Browser/device info for audit
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentFields = pgTable("document_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => recipients.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  page: integer("page").default(1).notNull(),
  xPosition: integer("x_position").notNull(),
  yPosition: integer("y_position").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  required: boolean("required").default(true).notNull(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id),
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  fields: jsonb("fields"),
  recipientSlots: jsonb("recipient_slots"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").references(() => recipients.id),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workflow tables
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id),
  name: text("name").notNull(),
  description: text("description"),
  // Workflow definition stored as JSON (steps, conditions, etc.)
  definition: jsonb("definition").notNull(),
  status: text("status").default("active").notNull(), // active, inactive, deleted
  version: text("version").default("1.0.0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("workflows_user_id_idx").on(table.userId),
  statusIdx: index("workflows_status_idx").on(table.status),
  teamIdIdx: index("workflows_team_id_idx").on(table.teamId),
}));

export const workflowExecutions = pgTable("workflow_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(), // pending, running, completed, failed
  // Execution context - variables passed between steps
  context: jsonb("context"),
  currentStepIndex: integer("current_step_index").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  workflowIdIdx: index("workflow_executions_workflow_id_idx").on(table.workflowId),
  documentIdIdx: index("workflow_executions_document_id_idx").on(table.documentId),
  statusIdx: index("workflow_executions_status_idx").on(table.status),
  completedAtIdx: index("workflow_executions_completed_at_idx").on(table.completedAt),
}));

export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .notNull()
    .references(() => workflowExecutions.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  stepType: text("step_type").notNull(), // send_document, await_signature, approval_gate, conditional_branch, parallel, wait
  status: text("status").default("pending").notNull(), // pending, running, completed, failed, skipped
  assignedTo: uuid("assigned_to").references(() => users.id),
  // Step execution result (approval decision, condition result, etc.)
  result: jsonb("result"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  executionIdIdx: index("workflow_steps_execution_id_idx").on(table.executionId),
  statusIdx: index("workflow_steps_status_idx").on(table.status),
  assignedToIdx: index("workflow_steps_assigned_to_idx").on(table.assignedTo),
}));

// Approval tables
export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  stepId: uuid("step_id")
    .notNull()
    .references(() => workflowSteps.id, { onDelete: "cascade" }),
  mode: text("mode").default("all").notNull(), // any, all, majority
  status: text("status").default("pending").notNull(), // pending, approved, rejected, expired
  requiredApprovals: integer("required_approvals").notNull(), // number of approvals needed
  currentApprovals: integer("current_approvals").default(0).notNull(),
  currentRejections: integer("current_rejections").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stepIdIdx: index("approval_requests_step_id_idx").on(table.stepId),
  statusIdx: index("approval_requests_status_idx").on(table.status),
  expiresAtIdx: index("approval_requests_expires_at_idx").on(table.expiresAt),
}));

export const approvalResponses = pgTable("approval_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => approvalRequests.id, { onDelete: "cascade" }),
  approverId: uuid("approver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(), // approved, rejected
  comment: text("comment"),
  respondedAt: timestamp("responded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  requestIdIdx: index("approval_responses_request_id_idx").on(table.requestId),
  approverIdIdx: index("approval_responses_approver_id_idx").on(table.approverId),
  respondedAtIdx: index("approval_responses_responded_at_idx").on(table.respondedAt),
}));

export const approvalTokens = pgTable("approval_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => approvalRequests.id, { onDelete: "cascade" }),
  approverId: uuid("approver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  decision: text("decision").notNull(), // approved, rejected
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("approval_tokens_token_idx").on(table.token),
  requestIdIdx: index("approval_tokens_request_id_idx").on(table.requestId),
  usedIdx: index("approval_tokens_used_idx").on(table.used),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  teams: many(teamMembers),
  templates: many(templates),
  workflows: many(workflows),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [documents.teamId],
    references: [teams.id],
  }),
  recipients: many(recipients),
  fields: many(documentFields),
  auditLogs: many(auditLogs),
}));

export const recipientsRelations = relations(recipients, ({ one, many }) => ({
  document: one(documents, {
    fields: [recipients.documentId],
    references: [documents.id],
  }),
  fields: many(documentFields),
}));

export const documentFieldsRelations = relations(documentFields, ({ one }) => ({
  document: one(documents, {
    fields: [documentFields.documentId],
    references: [documents.id],
  }),
  recipient: one(recipients, {
    fields: [documentFields.recipientId],
    references: [recipients.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [workflows.teamId],
    references: [teams.id],
  }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id],
  }),
  document: one(documents, {
    fields: [workflowExecutions.documentId],
    references: [documents.id],
  }),
  steps: many(workflowSteps),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one, many }) => ({
  execution: one(workflowExecutions, {
    fields: [workflowSteps.executionId],
    references: [workflowExecutions.id],
  }),
  assignedUser: one(users, {
    fields: [workflowSteps.assignedTo],
    references: [users.id],
  }),
  approvalRequest: one(approvalRequests, {
    fields: [workflowSteps.id],
    references: [approvalRequests.stepId],
  }),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
  step: one(workflowSteps, {
    fields: [approvalRequests.stepId],
    references: [workflowSteps.id],
  }),
  responses: many(approvalResponses),
}));

export const approvalResponsesRelations = relations(approvalResponses, ({ one }) => ({
  request: one(approvalRequests, {
    fields: [approvalResponses.requestId],
    references: [approvalRequests.id],
  }),
  approver: one(users, {
    fields: [approvalResponses.approverId],
    references: [users.id],
  }),
}));
