import { pgTable, text, boolean, integer, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const toolParameterSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  default: z.any().optional(),
});

export const toolParametersSchema = z.object({
  type: z.literal("object"),
  properties: z.record(toolParameterSchema),
  required: z.array(z.string()).optional(),
});

export const httpConfigSchema = z.object({
  endpoint: z.string().url().optional().or(z.literal("")),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  headers: z.record(z.string()).optional(),
  bodyTemplate: z.string().optional(),
});

export type ToolParameters = z.infer<typeof toolParametersSchema>;
export type HttpConfig = z.infer<typeof httpConfigSchema>;

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tools = pgTable("tools", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  description: text("description").notNull(),
  parameters: jsonb("parameters").notNull().$type<ToolParameters>(),
  httpConfig: jsonb("http_config").$type<HttpConfig>(),
  preprocessing: text("preprocessing"),
  postprocessing: text("postprocessing"),
  fakeResponse: text("fake_response"),
  useFakeResponse: boolean("use_fake_response").default(false).notNull(),
  useHttpRequest: boolean("use_http_request").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  executionCount: integer("execution_count").default(0).notNull(),
  lastModified: timestamp("last_modified").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chainStepSchema = z.object({
  toolId: z.string(),
  inputMapping: z.record(z.string()).optional(),
  continueOnError: z.boolean().default(false),
});

export type ChainStep = z.infer<typeof chainStepSchema>;

export const toolChains = pgTable("tool_chains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  description: text("description").notNull(),
  parameters: jsonb("parameters").$type<ToolParameters>(),
  steps: jsonb("steps").notNull().$type<ChainStep[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  executionCount: integer("execution_count").default(0).notNull(),
  lastModified: timestamp("last_modified").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
}));

export const toolsRelations = relations(tools, ({ many }) => ({
}));

export const toolChainsRelations = relations(toolChains, ({ many }) => ({
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertToolSchema = createInsertSchema(tools).omit({ id: true, executionCount: true, lastModified: true, createdAt: true }).extend({
  name: z.string().min(1, "Name is required").regex(/^[a-z_][a-z0-9_]*$/i, "Name must be alphanumeric with underscores"),
  description: z.string().min(1, "Description is required"),
  parameters: toolParametersSchema,
  httpConfig: httpConfigSchema.optional(),
});
export const insertChainSchema = createInsertSchema(toolChains).omit({ id: true, executionCount: true, lastModified: true, createdAt: true }).extend({
  name: z.string().min(1, "Name is required").regex(/^[a-z_][a-z0-9_-]*$/i, "Name must be alphanumeric with underscores or hyphens"),
  description: z.string().min(1, "Description is required"),
  parameters: toolParametersSchema.optional(),
  steps: z.array(chainStepSchema).min(1, "At least one step is required"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Tool = typeof tools.$inferSelect;
export type InsertTool = z.infer<typeof insertToolSchema>;
export type ToolChain = typeof toolChains.$inferSelect;
export type InsertChain = z.infer<typeof insertChainSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export const mistralFunctionSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: toolParametersSchema,
  }),
});

export type MistralFunction = z.infer<typeof mistralFunctionSchema>;

export const toolExecutionSchema = z.object({
  toolName: z.string(),
  parameters: z.record(z.any()),
});

export type ToolExecution = z.infer<typeof toolExecutionSchema>;

export const executionLogSchema = z.object({
  preprocessing: z.object({
    originalParams: z.record(z.any()),
    processedParams: z.record(z.any()),
    codeExecuted: z.string().optional(),
  }).optional(),
  httpCall: z.object({
    url: z.string(),
    method: z.string(),
    headers: z.record(z.string()),
    body: z.string().optional(),
    responseStatus: z.number().optional(),
    responseBody: z.any().optional(),
  }).optional(),
  postprocessing: z.object({
    rawResponse: z.any(),
    processedResponse: z.any(),
    codeExecuted: z.string().optional(),
  }).optional(),
  finalResult: z.any().optional(),
});

export type ExecutionLog = z.infer<typeof executionLogSchema>;

export const toolExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number(),
  executionLog: executionLogSchema.optional(),
});

export type ToolExecutionResult = z.infer<typeof toolExecutionResultSchema>;

export const chainExecutionResultSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    stepIndex: z.number(),
    toolId: z.string(),
    toolName: z.string(),
    success: z.boolean(),
    result: z.any().optional(),
    error: z.string().optional(),
    executionTime: z.number(),
  })),
  totalExecutionTime: z.number(),
  error: z.string().optional(),
});

export type ChainExecutionResult = z.infer<typeof chainExecutionResultSchema>;

export const apiKeyConfigSchema = z.object({
  key: z.string(),
  createdAt: z.coerce.date(),
});

export type ApiKeyConfig = z.infer<typeof apiKeyConfigSchema>;
