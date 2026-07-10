import { pgTable, text, boolean, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Users ───────────────────────────────────────────────────────────────────
// A user can authenticate via email/password OR Google OAuth (or both).
// passwordHash is nullable — a Google-only account has no password.
// googleId is nullable — an email-only account has no Google link.
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),                    // bcrypt hash (null for Google-only)
  googleId: text("google_id").unique(),                   // Google sub / user id (null for email-only)
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  githubHandle: text("github_handle"),
  timezone: text("timezone").default("UTC").notNull(),
  orgName: text("org_name"),
  role: text("role").notNull().default("owner"),          // 'owner' | 'member' | 'admin'
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ─── Login Attempts (brute-force protection) ─────────────────────────────────
export const loginAttemptsTable = pgTable("login_attempts", {
  identifier: text("identifier").primaryKey(),            // '<ip>:<email>'
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Password Reset Tokens ───────────────────────────────────────────────────
export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Projects ────────────────────────────────────────────────────────────────
export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
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

// ─── Settings (per-user) ─────────────────────────────────────────────────────
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
