import { 
  users, tools, toolChains, apiKeys,
  type User, type InsertUser, 
  type Tool, type InsertTool, 
  type ToolChain, type InsertChain,
  type ApiKeyConfig,
  type ToolParameters
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const defaultChainParameters: ToolParameters = {
  type: "object",
  properties: {},
  required: [],
};

function normalizeChainParameters(chain: ToolChain): ToolChain {
  const normalized = normalizeInputParameters(chain.parameters);
  return { ...chain, parameters: normalized };
}

function normalizeInputParameters(params: ToolParameters | undefined | null): ToolParameters {
  if (
    !params || 
    params.type !== "object" || 
    typeof params.properties !== "object" ||
    params.properties === null ||
    Array.isArray(params.properties)
  ) {
    return defaultChainParameters;
  }
  
  const cleanProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params.properties)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleanProperties[key] = value;
    }
  }
  
  const propertyKeys = new Set(Object.keys(cleanProperties));
  const cleanRequired = Array.isArray(params.required) 
    ? params.required.filter((r): r is string => typeof r === "string" && propertyKeys.has(r))
    : [];
  
  const result: ToolParameters = {
    ...params,
    type: "object",
    properties: cleanProperties as ToolParameters["properties"],
    required: cleanRequired,
  };
  
  return result;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  
  getAllTools(): Promise<Tool[]>;
  getTool(id: string): Promise<Tool | undefined>;
  getToolByName(name: string): Promise<Tool | undefined>;
  createTool(tool: InsertTool): Promise<Tool>;
  updateTool(id: string, tool: Partial<InsertTool>): Promise<Tool | undefined>;
  deleteTool(id: string): Promise<boolean>;
  incrementExecutionCount(id: string): Promise<void>;
  getActiveTools(): Promise<Tool[]>;
  
  getAllChains(): Promise<ToolChain[]>;
  getChain(id: string): Promise<ToolChain | undefined>;
  getChainByName(name: string): Promise<ToolChain | undefined>;
  createChain(chain: InsertChain): Promise<ToolChain>;
  updateChain(id: string, chain: Partial<InsertChain>): Promise<ToolChain | undefined>;
  deleteChain(id: string): Promise<boolean>;
  incrementChainExecutionCount(id: string): Promise<void>;
  getActiveChains(): Promise<ToolChain[]>;
  
  getApiKey(): Promise<ApiKeyConfig>;
  regenerateApiKey(): Promise<ApiKeyConfig>;
  
  initializeSampleData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private generateApiKey(): string {
    return `caesar_${randomUUID().replace(/-/g, "").substring(0, 24)}`;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllTools(): Promise<Tool[]> {
    return db.select().from(tools).orderBy(desc(tools.lastModified));
  }

  async getTool(id: string): Promise<Tool | undefined> {
    const [tool] = await db.select().from(tools).where(eq(tools.id, id));
    return tool || undefined;
  }

  async getToolByName(name: string): Promise<Tool | undefined> {
    const [tool] = await db.select().from(tools).where(eq(tools.name, name));
    return tool || undefined;
  }

  async createTool(insertTool: InsertTool): Promise<Tool> {
    const [tool] = await db.insert(tools).values({
      ...insertTool,
      lastModified: new Date(),
    }).returning();
    return tool;
  }

  async updateTool(id: string, updates: Partial<InsertTool>): Promise<Tool | undefined> {
    const [tool] = await db
      .update(tools)
      .set({ ...updates, lastModified: new Date() })
      .where(eq(tools.id, id))
      .returning();
    return tool || undefined;
  }

  async deleteTool(id: string): Promise<boolean> {
    const result = await db.delete(tools).where(eq(tools.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async incrementExecutionCount(id: string): Promise<void> {
    await db
      .update(tools)
      .set({ 
        executionCount: sql`${tools.executionCount} + 1`,
        lastModified: new Date()
      })
      .where(eq(tools.id, id));
  }

  async getActiveTools(): Promise<Tool[]> {
    return db.select().from(tools).where(eq(tools.isActive, true));
  }

  async getAllChains(): Promise<ToolChain[]> {
    const chains = await db.select().from(toolChains).orderBy(desc(toolChains.lastModified));
    return chains.map(normalizeChainParameters);
  }

  async getChain(id: string): Promise<ToolChain | undefined> {
    const [chain] = await db.select().from(toolChains).where(eq(toolChains.id, id));
    return chain ? normalizeChainParameters(chain) : undefined;
  }

  async getChainByName(name: string): Promise<ToolChain | undefined> {
    const [chain] = await db.select().from(toolChains).where(eq(toolChains.name, name));
    return chain ? normalizeChainParameters(chain) : undefined;
  }

  async createChain(insertChain: InsertChain): Promise<ToolChain> {
    const [chain] = await db.insert(toolChains).values({
      ...insertChain,
      parameters: normalizeInputParameters(insertChain.parameters),
      lastModified: new Date(),
    }).returning();
    return normalizeChainParameters(chain);
  }

  async updateChain(id: string, updates: Partial<InsertChain>): Promise<ToolChain | undefined> {
    const updateData: Record<string, unknown> = {
      ...updates,
      lastModified: new Date(),
    };
    if ('parameters' in updates) {
      updateData.parameters = normalizeInputParameters(updates.parameters);
    }
    const [chain] = await db
      .update(toolChains)
      .set(updateData)
      .where(eq(toolChains.id, id))
      .returning();
    return chain ? normalizeChainParameters(chain) : undefined;
  }

  async deleteChain(id: string): Promise<boolean> {
    const result = await db.delete(toolChains).where(eq(toolChains.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async incrementChainExecutionCount(id: string): Promise<void> {
    await db
      .update(toolChains)
      .set({ 
        executionCount: sql`${toolChains.executionCount} + 1`,
        lastModified: new Date()
      })
      .where(eq(toolChains.id, id));
  }

  async getActiveChains(): Promise<ToolChain[]> {
    const chains = await db.select().from(toolChains).where(eq(toolChains.isActive, true));
    return chains.map(normalizeChainParameters);
  }

  async getApiKey(): Promise<ApiKeyConfig> {
    const [existing] = await db.select().from(apiKeys).limit(1);
    if (existing) {
      return { key: existing.key, createdAt: existing.createdAt };
    }
    const newKey = this.generateApiKey();
    const [created] = await db.insert(apiKeys).values({ key: newKey }).returning();
    return { key: created.key, createdAt: created.createdAt };
  }

  async regenerateApiKey(): Promise<ApiKeyConfig> {
    await db.delete(apiKeys);
    const newKey = this.generateApiKey();
    const [created] = await db.insert(apiKeys).values({ key: newKey }).returning();
    return { key: created.key, createdAt: created.createdAt };
  }

  async initializeSampleData(): Promise<void> {
    const existingTools = await db.select().from(tools).limit(1);
    if (existingTools.length > 0) return;

    const sampleTools: InsertTool[] = [
      {
        name: "get_weather",
        description: "Get current weather information for a specified location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city name, e.g. 'Berlin' or 'New York'",
            },
            units: {
              type: "string",
              description: "Temperature units",
              enum: ["celsius", "fahrenheit"],
            },
          },
          required: ["location"],
        },
        httpConfig: {
          endpoint: "https://api.example.com/weather",
          method: "GET",
          headers: {},
          bodyTemplate: "",
        },
        useFakeResponse: true,
        fakeResponse: JSON.stringify({
          location: "Berlin",
          temperature: 18,
          units: "celsius",
          conditions: "partly cloudy",
          humidity: 65,
        }, null, 2),
        isActive: true,
      },
      {
        name: "search_database",
        description: "Search for records in the database using a query string",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
            limit: {
              type: "integer",
              description: "Maximum number of results to return",
            },
            offset: {
              type: "integer",
              description: "Number of results to skip",
            },
          },
          required: ["query"],
        },
        httpConfig: {
          endpoint: "",
          method: "POST",
          headers: {},
          bodyTemplate: '{"search": "{{query}}", "limit": {{limit}}, "offset": {{offset}}}',
        },
        useFakeResponse: true,
        fakeResponse: JSON.stringify({
          total: 42,
          results: [
            { id: 1, title: "First result", score: 0.95 },
            { id: 2, title: "Second result", score: 0.87 },
          ],
        }, null, 2),
        isActive: true,
      },
      {
        name: "send_notification",
        description: "Send a notification message to a user or channel",
        parameters: {
          type: "object",
          properties: {
            recipient: {
              type: "string",
              description: "The recipient user ID or channel name",
            },
            message: {
              type: "string",
              description: "The notification message content",
            },
            priority: {
              type: "string",
              description: "Message priority level",
              enum: ["low", "normal", "high", "urgent"],
            },
          },
          required: ["recipient", "message"],
        },
        httpConfig: {
          endpoint: "",
          method: "POST",
          headers: {},
          bodyTemplate: "",
        },
        useFakeResponse: true,
        fakeResponse: JSON.stringify({
          success: true,
          messageId: "msg_12345",
          deliveredAt: new Date().toISOString(),
        }, null, 2),
        isActive: false,
      },
    ];

    for (const tool of sampleTools) {
      await db.insert(tools).values({
        ...tool,
        executionCount: Math.floor(Math.random() * 50),
        lastModified: new Date(),
      });
    }
  }
}

export const storage = new DatabaseStorage();
