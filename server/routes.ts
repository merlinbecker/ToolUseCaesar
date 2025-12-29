import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertToolSchema, type MistralFunction, type ToolExecutionResult } from "@shared/schema";
import { z } from "zod";

const toolExecutionRequestSchema = z.object({
  parameters: z.record(z.unknown()).default({}),
});

const updateToolSchema = insertToolSchema.partial();

function executeSandboxedCode(
  code: string,
  inputName: string,
  input: unknown,
  expectedFnName: string
): unknown {
  if (!code || code.trim() === "") return input;
  
  try {
    const safeCode = code
      .replace(/require\s*\(/g, "/* disabled require */")
      .replace(/import\s+/g, "/* disabled import */")
      .replace(/process\./g, "/* disabled process */")
      .replace(/global\./g, "/* disabled global */")
      .replace(/eval\s*\(/g, "/* disabled eval */")
      .replace(/Function\s*\(/g, "/* disabled Function */");
    
    const fn = new Function(inputName, `
      "use strict";
      const require = undefined;
      const process = undefined;
      const global = undefined;
      const eval = undefined;
      const Function = undefined;
      const setTimeout = undefined;
      const setInterval = undefined;
      const fetch = undefined;
      
      ${safeCode}
      
      if (typeof ${expectedFnName} === 'function') {
        return ${expectedFnName}(${inputName});
      }
      return ${inputName};
    `);
    
    const result = fn(JSON.parse(JSON.stringify(input)));
    return result !== undefined ? result : input;
  } catch (error) {
    console.error(`${expectedFnName} execution error:`, error);
    return input;
  }
}

function executePreprocessing(code: string, params: Record<string, unknown>): Record<string, unknown> {
  const result = executeSandboxedCode(code, "params", params, "preprocess");
  return (result && typeof result === "object" && !Array.isArray(result)) 
    ? result as Record<string, unknown> 
    : params;
}

function executePostprocessing(code: string, response: unknown): unknown {
  return executeSandboxedCode(code, "response", response, "postprocess");
}

function interpolateTemplate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/tools", async (req: Request, res: Response) => {
    try {
      const tools = await storage.getAllTools();
      res.json(tools);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  app.get("/api/tools/:id", async (req: Request, res: Response) => {
    try {
      const tool = await storage.getTool(req.params.id);
      if (!tool) {
        res.status(404).json({ error: "Tool not found" });
        return;
      }
      res.json(tool);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tool" });
    }
  });

  app.post("/api/tools", async (req: Request, res: Response) => {
    try {
      const parsed = insertToolSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid tool data", details: parsed.error.errors });
        return;
      }

      const existing = await storage.getToolByName(parsed.data.name);
      if (existing) {
        res.status(409).json({ error: "Tool with this name already exists" });
        return;
      }

      const tool = await storage.createTool(parsed.data);
      res.status(201).json(tool);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tool" });
    }
  });

  app.put("/api/tools/:id", async (req: Request, res: Response) => {
    try {
      const parsed = insertToolSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid tool data", details: parsed.error.errors });
        return;
      }

      const existing = await storage.getToolByName(parsed.data.name);
      if (existing && existing.id !== req.params.id) {
        res.status(409).json({ error: "Tool with this name already exists" });
        return;
      }

      const tool = await storage.updateTool(req.params.id, parsed.data);
      if (!tool) {
        res.status(404).json({ error: "Tool not found" });
        return;
      }
      res.json(tool);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tool" });
    }
  });

  app.patch("/api/tools/:id", async (req: Request, res: Response) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        res.status(400).json({ error: "isActive must be a boolean" });
        return;
      }

      const tool = await storage.updateTool(req.params.id, { isActive });
      if (!tool) {
        res.status(404).json({ error: "Tool not found" });
        return;
      }
      res.json(tool);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tool" });
    }
  });

  app.delete("/api/tools/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteTool(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Tool not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });

  app.post("/api/tools/:id/execute", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const parsed = toolExecutionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ 
          error: "Invalid request format", 
          details: parsed.error.errors 
        });
        return;
      }

      const tool = await storage.getTool(req.params.id);
      if (!tool) {
        res.status(404).json({ error: "Tool not found" });
        return;
      }

      const parameters = parsed.data.parameters;
      
      let processedParams = parameters;
      if (tool.preprocessing) {
        processedParams = executePreprocessing(tool.preprocessing, parameters);
      }

      let result: unknown;

      if (tool.useFakeResponse && tool.fakeResponse) {
        try {
          result = JSON.parse(tool.fakeResponse);
        } catch {
          result = tool.fakeResponse;
        }
      } else if (tool.httpConfig?.endpoint) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...tool.httpConfig.headers,
          };

          let body: string | undefined;
          if (tool.httpConfig.method !== "GET" && tool.httpConfig.bodyTemplate) {
            body = interpolateTemplate(tool.httpConfig.bodyTemplate, processedParams);
          }

          const response = await fetch(tool.httpConfig.endpoint, {
            method: tool.httpConfig.method,
            headers,
            body,
          });

          result = await response.json();
        } catch (error) {
          const executionTime = Date.now() - startTime;
          await storage.incrementExecutionCount(tool.id);
          const execResult: ToolExecutionResult = {
            success: false,
            error: `HTTP request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            executionTime,
          };
          res.json(execResult);
          return;
        }
      } else {
        result = { message: "No endpoint configured and fake response disabled" };
      }

      if (tool.postprocessing) {
        result = executePostprocessing(tool.postprocessing, result);
      }

      await storage.incrementExecutionCount(tool.id);
      const executionTime = Date.now() - startTime;

      const execResult: ToolExecutionResult = {
        success: true,
        result,
        executionTime,
      };

      res.json(execResult);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const execResult: ToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime,
      };
      res.json(execResult);
    }
  });

  app.get("/api/settings/api-key", async (req: Request, res: Response) => {
    try {
      const apiKey = await storage.getApiKey();
      res.json(apiKey);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API key" });
    }
  });

  app.post("/api/settings/api-key/regenerate", async (req: Request, res: Response) => {
    try {
      const apiKey = await storage.regenerateApiKey();
      res.json(apiKey);
    } catch (error) {
      res.status(500).json({ error: "Failed to regenerate API key" });
    }
  });

  app.get("/:apiKey/tools", async (req: Request, res: Response) => {
    try {
      const storedKey = await storage.getApiKey();
      if (req.params.apiKey !== storedKey.key) {
        res.status(404).send("Not Found");
        return;
      }

      const tools = await storage.getActiveTools();
      const mistralFormat: MistralFunction[] = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      res.json(mistralFormat);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  app.post("/:apiKey/tools/:toolName", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const storedKey = await storage.getApiKey();
      if (req.params.apiKey !== storedKey.key) {
        res.status(404).send("Not Found");
        return;
      }

      const tool = await storage.getToolByName(req.params.toolName);
      if (!tool) {
        res.status(404).json({ error: "Tool not found" });
        return;
      }

      if (!tool.isActive) {
        res.status(403).json({ error: "Tool is not active" });
        return;
      }

      const parameters = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) 
        ? req.body as Record<string, unknown>
        : {};

      let processedParams = parameters;
      if (tool.preprocessing) {
        processedParams = executePreprocessing(tool.preprocessing, parameters);
      }

      let result: unknown;

      if (tool.useFakeResponse && tool.fakeResponse) {
        try {
          result = JSON.parse(tool.fakeResponse);
        } catch {
          result = tool.fakeResponse;
        }
      } else if (tool.httpConfig?.endpoint) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...tool.httpConfig.headers,
          };

          let body: string | undefined;
          if (tool.httpConfig.method !== "GET" && tool.httpConfig.bodyTemplate) {
            body = interpolateTemplate(tool.httpConfig.bodyTemplate, processedParams);
          }

          const response = await fetch(tool.httpConfig.endpoint, {
            method: tool.httpConfig.method,
            headers,
            body,
          });

          result = await response.json();
        } catch (error) {
          const executionTime = Date.now() - startTime;
          await storage.incrementExecutionCount(tool.id);
          res.status(500).json({
            error: `HTTP request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            executionTime,
          });
          return;
        }
      } else {
        result = { message: "No endpoint configured and fake response disabled" };
      }

      if (tool.postprocessing) {
        result = executePostprocessing(tool.postprocessing, result);
      }

      await storage.incrementExecutionCount(tool.id);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}
