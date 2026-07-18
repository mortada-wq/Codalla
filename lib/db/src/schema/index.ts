import { pgTable, text, boolean, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Users ───────────────────────────────────────────────────────────────────
// Sign-in is Google-only (googleId = Google's stable `sub` claim). With
// AUTH_DISABLED=true the server instead uses one implicit "local" user row,
// which has no googleId — hence the column stays nullable.
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  googleId: text("google_id").unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  githubHandle: text("github_handle"),
  timezone: text("timezone").default("UTC").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Server-side sessions: the browser cookie holds a random token, the DB holds
// its SHA-256 hash. Deleting a row signs that browser out immediately.
export const sessionsTable = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Session = typeof sessionsTable.$inferSelect;

// ─── Workflows ────────────────────────────────────────────────────────────────
// Reusable AI pipeline presets. Deliberately modality-agnostic: a workflow is
// an ordered list of prompt steps run sequentially in a project's chat, so the
// same machinery covers chat-data prep, image-dataset prep, coding, etc.
export type WorkflowStep = { title: string; prompt: string };

export const workflowsTable = pgTable("workflows", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Shared workflows are runnable by every account; owner-only edit/delete.
  isShared: boolean("is_shared").default(false).notNull(),
  description: text("description"),
  steps: jsonb("steps").$type<WorkflowStep[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Workflow = typeof workflowsTable.$inferSelect;

// ─── Projects ────────────────────────────────────────────────────────────────
export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Team sharing: shared projects are visible and editable by every account;
  // only the owner can change settings, share state, or delete.
  isShared: boolean("is_shared").default(false).notNull(),
  localPath: text("local_path").notNull(),
  gitRemoteUrl: text("git_remote_url"),
  currentBranch: text("current_branch").default("main"),
  description: text("description"),
  story: text("story"),
  target: text("target"),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertProjectSchema = createInsertSchema(projectsTable).omit({ createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

// ─── Project Assets (AI-generated files & media descriptions) ───────────────
// Every file written by the AI (via generate-files or media analysis) leaves
// a row here so we have an auditable database record beside the on-disk file.
// Kind: 'ai-generated' (source: prompt), 'media-description' (source: analysis of an image/audio file)
export const projectAssetsTable = pgTable("project_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),                              // 'ai-generated' | 'media-description'
  path: text("path").notNull(),                              // relative path inside project
  sourcePath: text("source_path"),                           // for media descriptions: the image/audio file described
  sourceMimeType: text("source_mime_type"),                  // 'image/png', 'audio/wav', etc.
  prompt: text("prompt"),                                    // user's prompt (for ai-generated) or analysis instructions
  model: text("model"),                                      // model that generated this
  provider: text("provider"),
  sizeBytes: integer("size_bytes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertProjectAssetSchema = createInsertSchema(projectAssetsTable).omit({ createdAt: true });
export type InsertProjectAsset = z.infer<typeof insertProjectAssetSchema>;
export type ProjectAsset = typeof projectAssetsTable.$inferSelect;

// ─── Project Success Criteria ────────────────────────────────────────────────
export const projectSuccessCriteriaTable = pgTable("project_success_criteria", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: boolean("done").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertSuccessCriterionSchema = createInsertSchema(projectSuccessCriteriaTable).omit({ createdAt: true, updatedAt: true });
export type InsertSuccessCriterion = z.infer<typeof insertSuccessCriterionSchema>;
export type SuccessCriterion = typeof projectSuccessCriteriaTable.$inferSelect;

// ─── Project Memory Notes ────────────────────────────────────────────────────
export const projectMemoryNotesTable = pgTable("project_memory_notes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertMemoryNoteSchema = createInsertSchema(projectMemoryNotesTable).omit({ createdAt: true, updatedAt: true });
export type InsertMemoryNote = z.infer<typeof insertMemoryNoteSchema>;
export type MemoryNote = typeof projectMemoryNotesTable.$inferSelect;

// ─── API Keys ────────────────────────────────────────────────────────────────
export const apiKeysTable = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  keyValue: text("key_value").notNull(),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({ createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: text("project_id"),
  title: text("title"),
  modelId: text("model_id").notNull(),
  provider: text("provider").notNull(),
  totalCost: real("total_cost").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;

// ─── Messages ────────────────────────────────────────────────────────────────
export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  tokensUsed: integer("tokens_used"),
  cost: real("cost"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

// ─── Usage Log ───────────────────────────────────────────────────────────────
export const usageLogTable = pgTable("usage_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  provider: text("provider").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  cost: real("cost").notNull().default(0),
  action: text("action"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertUsageLogSchema = createInsertSchema(usageLogTable).omit({ createdAt: true });
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;
export type UsageLog = typeof usageLogTable.$inferSelect;

// ─── Custom Models ────────────────────────────────────────────────────────────
export const customModelsTable = pgTable("custom_models", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  modelId: text("model_id").notNull(),
  provider: text("provider").notNull(),
  description: text("description"),
  contextLength: integer("context_length").default(8192),
  pricingPrompt: real("pricing_prompt").default(0),
  pricingCompletion: real("pricing_completion").default(0),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertCustomModelSchema = createInsertSchema(customModelsTable).omit({ createdAt: true });
export type InsertCustomModel = z.infer<typeof insertCustomModelSchema>;
export type CustomModel = typeof customModelsTable.$inferSelect;

// ─── AI Development Patterns ──────────────────────────────────────────────────
// Reusable patterns, solutions, and best practices for AI development.
export type PatternProblemType = "prompt" | "data-pipeline" | "model-integration" | "fine-tuning" | "general";

export const patternsTable = pgTable("patterns", {
  id: text("id").primaryKey(),
  // null userId = built-in pattern; otherwise team-owned pattern
  userId: text("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  problemType: text("problem_type").$type<PatternProblemType>().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // Keywords that signal this pattern should be suggested
  triggers: jsonb("triggers").$type<string[]>().notNull().default([]),
  // The pattern content: template, steps, example code
  template: text("template").notNull(),
  // Example code snippet demonstrating the pattern
  example: text("example"),
  // Related resources or links
  resources: jsonb("resources").$type<Array<{ title: string; url: string }>>().notNull().default([]),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertPatternSchema = createInsertSchema(patternsTable).omit({ createdAt: true, updatedAt: true });
export type InsertPattern = z.infer<typeof insertPatternSchema>;
export type Pattern = typeof patternsTable.$inferSelect;

// ─── Pattern Usage Log ──────────────────────────────────────────────────────────
// Track which patterns were suggested and whether they were helpful.
export const patternUsageLogTable = pgTable("pattern_usage_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  patternId: text("pattern_id").notNull().references(() => patternsTable.id, { onDelete: "cascade" }),
  // Was this pattern suggested to the user?
  wasSuggested: boolean("was_suggested").default(false).notNull(),
  // Did the user adopt it?
  wasAdopted: boolean("was_adopted").default(false).notNull(),
  // Did it solve the problem?
  helpful: boolean("helpful"),
  // User feedback
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertPatternUsageLogSchema = createInsertSchema(patternUsageLogTable).omit({ createdAt: true });
export type InsertPatternUsageLog = z.infer<typeof insertPatternUsageLogSchema>;
export type PatternUsageLog = typeof patternUsageLogTable.$inferSelect;

// ─── Workflow Executions ──────────────────────────────────────────────────────
// Track runs of workflow templates: design → implement → test → deploy, etc.
// Enables checkpointing and resumability for multi-step problem solving.
export type WorkflowExecutionStatus = "pending" | "running" | "completed" | "failed";

export const workflowExecutionTable = pgTable("workflow_execution", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull().references(() => workflowsTable.id, { onDelete: "cascade" }),
  status: text("status").$type<WorkflowExecutionStatus>().notNull().default("pending"),
  // Current step index in the workflow steps array
  currentStepIndex: integer("current_step_index").default(0).notNull(),
  // Total cost accumulated during this execution
  totalCost: real("total_cost").default(0).notNull(),
  // Overall context/results from the execution
  context: jsonb("context").$type<Record<string, any>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutionTable).omit({ createdAt: true, updatedAt: true });
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecution = typeof workflowExecutionTable.$inferSelect;

// ─── Workflow Step Execution ───────────────────────────────────────────────────
// Log each step's execution: input, output, errors, token usage, and timing.
export type StepExecutionStatus = "pending" | "running" | "completed" | "failed";

export const workflowStepExecutionTable = pgTable("workflow_step_execution", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => workflowExecutionTable.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  status: text("status").$type<StepExecutionStatus>().notNull().default("pending"),
  // The step prompt/title
  title: text("title").notNull(),
  // Input context for this step (from previous step or user)
  input: jsonb("input").$type<Record<string, any>>().notNull().default({}),
  // Output/result from this step
  output: text("output"),
  // Error message if step failed
  error: text("error"),
  // Token usage for this step
  tokensUsed: integer("tokens_used").default(0),
  cost: real("cost").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export const insertWorkflowStepExecutionSchema = createInsertSchema(workflowStepExecutionTable).omit({ createdAt: true });
export type InsertWorkflowStepExecution = z.infer<typeof insertWorkflowStepExecutionSchema>;
export type WorkflowStepExecution = typeof workflowStepExecutionTable.$inferSelect;

// ─── Settings (per-user) ─────────────────────────────────────────────────────────
export const settingsTable = pgTable("settings", {
  userId: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  defaultModelId: text("default_model_id").notNull().default("deepseek-ai/DeepSeek-V3"),
  defaultProvider: text("default_provider").notNull().default("siliconflow"),
  theme: text("theme").notNull().default("dark"),
  fontSize: integer("font_size").notNull().default(14),
  tabSize: integer("tab_size").notNull().default(2),
  wordWrap: boolean("word_wrap").notNull().default(true),
  minimap: boolean("minimap").notNull().default(false),
  sendContextWithMessages: boolean("send_context_with_messages").notNull().default(true),
  githubToken: text("github_token"),
  runpodEndpoint: text("runpod_endpoint"),
});
export const insertSettingsSchema = createInsertSchema(settingsTable);
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
