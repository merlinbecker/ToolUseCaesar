import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { 
  insertToolSchema, insertChainSchema,
  type MistralFunction, type ToolExecutionResult, type ChainExecutionResult, type Tool 
} from "@shared/schema";
import { z } from "zod";

const toolExecutionRequestSchema = z.object({
  parameters: z.record(z.unknown()).default({}),
});

const updateToolSchema = insertToolSchema.partial();
const updateChainSchema = insertChainSchema.partial();

function executeSandboxedCode(
  code: string,
  inputName: string,
  input: unknown,
  expectedFnName: string,
  timeout: number = 5000
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

async function executeTool(tool: Tool, parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
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
        return {
          success: false,
          error: `HTTP request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          executionTime,
        };
      }
    } else {
      result = { message: "No endpoint configured and fake response disabled" };
    }

    if (tool.postprocessing) {
      result = executePostprocessing(tool.postprocessing, result);
    }

    const executionTime = Date.now() - startTime;
    return {
      success: true,
      result,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      executionTime,
    };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  setupAuth(app);
  
  await storage.initializeSampleData();

  app.get("/api/tools", requireAuth, async (req: Request, res: Response) => {
    try {
      const tools = await storage.getAllTools();
      res.json(tools);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  app.get("/api/tools/:id", requireAuth, async (req: Request, res: Response) => {
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

  app.post("/api/tools", requireAuth, async (req: Request, res: Response) => {
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

  app.put("/api/tools/:id", requireAuth, async (req: Request, res: Response) => {
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

  app.patch("/api/tools/:id", requireAuth, async (req: Request, res: Response) => {
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

  app.delete("/api/tools/:id", requireAuth, async (req: Request, res: Response) => {
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

  app.post("/api/tools/:id/execute", requireAuth, async (req: Request, res: Response) => {
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

      const result = await executeTool(tool, parsed.data.parameters);
      await storage.incrementExecutionCount(tool.id);

      res.json(result);
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: 0,
      });
    }
  });

  app.get("/api/chains", requireAuth, async (req: Request, res: Response) => {
    try {
      const chains = await storage.getAllChains();
      res.json(chains);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chains" });
    }
  });

  app.get("/api/chains/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const chain = await storage.getChain(req.params.id);
      if (!chain) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }
      res.json(chain);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chain" });
    }
  });

  app.post("/api/chains", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertChainSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid chain data", details: parsed.error.errors });
        return;
      }

      const existing = await storage.getChainByName(parsed.data.name);
      if (existing) {
        res.status(409).json({ error: "Chain with this name already exists" });
        return;
      }

      const chain = await storage.createChain(parsed.data);
      res.status(201).json(chain);
    } catch (error) {
      res.status(500).json({ error: "Failed to create chain" });
    }
  });

  app.put("/api/chains/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertChainSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid chain data", details: parsed.error.errors });
        return;
      }

      const existing = await storage.getChainByName(parsed.data.name);
      if (existing && existing.id !== req.params.id) {
        res.status(409).json({ error: "Chain with this name already exists" });
        return;
      }

      const chain = await storage.updateChain(req.params.id, parsed.data);
      if (!chain) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }
      res.json(chain);
    } catch (error) {
      res.status(500).json({ error: "Failed to update chain" });
    }
  });

  app.patch("/api/chains/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        res.status(400).json({ error: "isActive must be a boolean" });
        return;
      }

      const chain = await storage.updateChain(req.params.id, { isActive });
      if (!chain) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }
      res.json(chain);
    } catch (error) {
      res.status(500).json({ error: "Failed to update chain" });
    }
  });

  app.delete("/api/chains/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteChain(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete chain" });
    }
  });

  app.post("/api/chains/:id/execute", requireAuth, async (req: Request, res: Response) => {
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

      const chain = await storage.getChain(req.params.id);
      if (!chain) {
        res.status(404).json({ error: "Chain not found" });
        return;
      }

      const results: ChainExecutionResult["results"] = [];
      let previousResult: unknown = parsed.data.parameters;
      let chainSuccess = true;

      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        const tool = await storage.getTool(step.toolId);
        
        if (!tool) {
          results.push({
            stepIndex: i,
            toolId: step.toolId,
            toolName: "unknown",
            success: false,
            error: `Tool not found: ${step.toolId}`,
            executionTime: 0,
          });
          if (!step.continueOnError) {
            chainSuccess = false;
            break;
          }
          continue;
        }

        let stepParams: Record<string, unknown> = {};
        
        if (step.inputMapping && typeof previousResult === "object" && previousResult !== null) {
          for (const [paramKey, mappingExpr] of Object.entries(step.inputMapping)) {
            try {
              if (mappingExpr.startsWith("$.")) {
                const path = mappingExpr.slice(2).split(".");
                let value: unknown = previousResult;
                for (const key of path) {
                  if (value && typeof value === "object") {
                    value = (value as Record<string, unknown>)[key];
                  } else {
                    value = undefined;
                    break;
                  }
                }
                stepParams[paramKey] = value;
              } else {
                stepParams[paramKey] = mappingExpr;
              }
            } catch {
              stepParams[paramKey] = undefined;
            }
          }
        } else if (i === 0) {
          stepParams = parsed.data.parameters;
        }

        const stepResult = await executeTool(tool, stepParams);
        await storage.incrementExecutionCount(tool.id);

        results.push({
          stepIndex: i,
          toolId: tool.id,
          toolName: tool.name,
          success: stepResult.success,
          result: stepResult.result,
          error: stepResult.error,
          executionTime: stepResult.executionTime,
        });

        if (!stepResult.success && !step.continueOnError) {
          chainSuccess = false;
          break;
        }

        previousResult = stepResult.result;
      }

      await storage.incrementChainExecutionCount(chain.id);

      const totalExecutionTime = Date.now() - startTime;
      const chainResult: ChainExecutionResult = {
        success: chainSuccess,
        results,
        totalExecutionTime,
      };

      res.json(chainResult);
    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      res.json({
        success: false,
        results: [],
        totalExecutionTime,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/settings/api-key", requireAuth, async (req: Request, res: Response) => {
    try {
      const apiKey = await storage.getApiKey();
      res.json(apiKey);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API key" });
    }
  });

  app.post("/api/settings/api-key/regenerate", requireAuth, async (req: Request, res: Response) => {
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
      const chains = await storage.getActiveChains();
      
      const toolFunctions: MistralFunction[] = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      const chainFunctions: MistralFunction[] = chains.map((chain) => ({
        type: "function",
        function: {
          name: `chain_${chain.name}`,
          description: `[Chain] ${chain.description}`,
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      }));

      res.json([...toolFunctions, ...chainFunctions]);
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

      const toolName = req.params.toolName;
      
      if (toolName.startsWith("chain_")) {
        const chainName = toolName.slice(6);
        const chain = await storage.getChainByName(chainName);
        if (!chain) {
          res.status(404).json({ error: "Chain not found" });
          return;
        }

        if (!chain.isActive) {
          res.status(403).json({ error: "Chain is not active" });
          return;
        }

        const parameters = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) 
          ? req.body as Record<string, unknown>
          : {};

        const results: ChainExecutionResult["results"] = [];
        let previousResult: unknown = parameters;
        let chainSuccess = true;

        for (let i = 0; i < chain.steps.length; i++) {
          const step = chain.steps[i];
          const tool = await storage.getTool(step.toolId);
          
          if (!tool) {
            results.push({
              stepIndex: i,
              toolId: step.toolId,
              toolName: "unknown",
              success: false,
              error: `Tool not found: ${step.toolId}`,
              executionTime: 0,
            });
            if (!step.continueOnError) {
              chainSuccess = false;
              break;
            }
            continue;
          }

          let stepParams: Record<string, unknown> = {};
          
          if (step.inputMapping && typeof previousResult === "object" && previousResult !== null) {
            for (const [paramKey, mappingExpr] of Object.entries(step.inputMapping)) {
              try {
                if (mappingExpr.startsWith("$.")) {
                  const path = mappingExpr.slice(2).split(".");
                  let value: unknown = previousResult;
                  for (const key of path) {
                    if (value && typeof value === "object") {
                      value = (value as Record<string, unknown>)[key];
                    } else {
                      value = undefined;
                      break;
                    }
                  }
                  stepParams[paramKey] = value;
                } else {
                  stepParams[paramKey] = mappingExpr;
                }
              } catch {
                stepParams[paramKey] = undefined;
              }
            }
          } else if (i === 0) {
            stepParams = parameters;
          }

          const stepResult = await executeTool(tool, stepParams);
          await storage.incrementExecutionCount(tool.id);

          results.push({
            stepIndex: i,
            toolId: tool.id,
            toolName: tool.name,
            success: stepResult.success,
            result: stepResult.result,
            error: stepResult.error,
            executionTime: stepResult.executionTime,
          });

          if (!stepResult.success && !step.continueOnError) {
            chainSuccess = false;
            break;
          }

          previousResult = stepResult.result;
        }

        await storage.incrementChainExecutionCount(chain.id);

        res.json(previousResult);
        return;
      }

      const tool = await storage.getToolByName(toolName);
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

      const result = await executeTool(tool, parameters);
      await storage.incrementExecutionCount(tool.id);

      res.json(result.result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return httpServer;
}
