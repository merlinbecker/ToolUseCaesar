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

export const toolSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").regex(/^[a-z_][a-z0-9_]*$/i, "Name must be alphanumeric with underscores"),
  description: z.string().min(1, "Description is required"),
  parameters: toolParametersSchema,
  httpConfig: httpConfigSchema.optional(),
  preprocessing: z.string().optional(),
  postprocessing: z.string().optional(),
  fakeResponse: z.string().optional(),
  useFakeResponse: z.boolean().default(false),
  isActive: z.boolean().default(true),
  executionCount: z.number().default(0),
  lastModified: z.string(),
  createdAt: z.string(),
});

export const insertToolSchema = toolSchema.omit({ id: true, executionCount: true, lastModified: true, createdAt: true });

export type Tool = z.infer<typeof toolSchema>;
export type InsertTool = z.infer<typeof insertToolSchema>;
export type ToolParameters = z.infer<typeof toolParametersSchema>;
export type HttpConfig = z.infer<typeof httpConfigSchema>;

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

export const toolExecutionResultSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number(),
});

export type ToolExecutionResult = z.infer<typeof toolExecutionResultSchema>;

export const apiKeyConfigSchema = z.object({
  key: z.string(),
  createdAt: z.string(),
});

export type ApiKeyConfig = z.infer<typeof apiKeyConfigSchema>;

export const users = null;
export type User = { id: string; username: string; password: string };
export type InsertUser = { username: string; password: string };
