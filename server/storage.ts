import type { Tool, InsertTool, ApiKeyConfig } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getAllTools(): Promise<Tool[]>;
  getTool(id: string): Promise<Tool | undefined>;
  getToolByName(name: string): Promise<Tool | undefined>;
  createTool(tool: InsertTool): Promise<Tool>;
  updateTool(id: string, tool: Partial<InsertTool>): Promise<Tool | undefined>;
  deleteTool(id: string): Promise<boolean>;
  incrementExecutionCount(id: string): Promise<void>;
  getActiveTools(): Promise<Tool[]>;
  getApiKey(): Promise<ApiKeyConfig>;
  regenerateApiKey(): Promise<ApiKeyConfig>;
}

export class MemStorage implements IStorage {
  private tools: Map<string, Tool>;
  private apiKey: ApiKeyConfig;

  constructor() {
    this.tools = new Map();
    this.apiKey = {
      key: this.generateApiKey(),
      createdAt: new Date().toISOString(),
    };

    this.initializeSampleTools();
  }

  private generateApiKey(): string {
    return `caesar_${randomUUID().replace(/-/g, "").substring(0, 24)}`;
  }

  private initializeSampleTools() {
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
      const id = randomUUID();
      const now = new Date().toISOString();
      this.tools.set(id, {
        ...tool,
        id,
        executionCount: Math.floor(Math.random() * 50),
        lastModified: now,
        createdAt: now,
      });
    }
  }

  async getAllTools(): Promise<Tool[]> {
    return Array.from(this.tools.values()).sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  async getTool(id: string): Promise<Tool | undefined> {
    return this.tools.get(id);
  }

  async getToolByName(name: string): Promise<Tool | undefined> {
    return Array.from(this.tools.values()).find((t) => t.name === name);
  }

  async createTool(insertTool: InsertTool): Promise<Tool> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const tool: Tool = {
      ...insertTool,
      id,
      executionCount: 0,
      lastModified: now,
      createdAt: now,
    };
    this.tools.set(id, tool);
    return tool;
  }

  async updateTool(id: string, updates: Partial<InsertTool>): Promise<Tool | undefined> {
    const existing = this.tools.get(id);
    if (!existing) return undefined;

    const updated: Tool = {
      ...existing,
      ...updates,
      id,
      lastModified: new Date().toISOString(),
    };
    this.tools.set(id, updated);
    return updated;
  }

  async deleteTool(id: string): Promise<boolean> {
    return this.tools.delete(id);
  }

  async incrementExecutionCount(id: string): Promise<void> {
    const tool = this.tools.get(id);
    if (tool) {
      tool.executionCount += 1;
      tool.lastModified = new Date().toISOString();
      this.tools.set(id, tool);
    }
  }

  async getActiveTools(): Promise<Tool[]> {
    return Array.from(this.tools.values()).filter((t) => t.isActive);
  }

  async getApiKey(): Promise<ApiKeyConfig> {
    return this.apiKey;
  }

  async regenerateApiKey(): Promise<ApiKeyConfig> {
    this.apiKey = {
      key: this.generateApiKey(),
      createdAt: new Date().toISOString(),
    };
    return this.apiKey;
  }
}

export const storage = new MemStorage();
