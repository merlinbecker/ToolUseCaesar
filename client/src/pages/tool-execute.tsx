import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Play, Copy, Check, Clock, AlertCircle, CheckCircle } from "lucide-react";
import type { Tool, ToolExecutionResult } from "@shared/schema";

interface ToolExecuteProps {
  tool?: Tool;
  isLoading: boolean;
  onExecute: (params: Record<string, unknown>) => void;
  isExecuting: boolean;
  result?: ToolExecutionResult;
}

export function ToolExecute({ tool, isLoading, onExecute, isExecuting, result }: ToolExecuteProps) {
  const [paramsJson, setParamsJson] = useState("{}");
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExecute = () => {
    try {
      const params = JSON.parse(paramsJson);
      setParamsError(null);
      onExecute(params);
    } catch (error) {
      setParamsError("Invalid JSON format");
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result.result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateSampleParams = () => {
    if (!tool) return;
    
    const sample: Record<string, unknown> = {};
    const props = tool.parameters.properties;
    
    for (const [key, value] of Object.entries(props)) {
      if (value.enum && value.enum.length > 0) {
        sample[key] = value.enum[0];
      } else if (value.default !== undefined) {
        sample[key] = value.default;
      } else {
        switch (value.type) {
          case "string":
            sample[key] = `example_${key}`;
            break;
          case "number":
          case "integer":
            sample[key] = 0;
            break;
          case "boolean":
            sample[key] = true;
            break;
          case "array":
            sample[key] = [];
            break;
          case "object":
            sample[key] = {};
            break;
          default:
            sample[key] = null;
        }
      }
    }
    
    setParamsJson(JSON.stringify(sample, null, 2));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="p-6">
        <Card className="p-12">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Tool not found</h2>
            <p className="text-sm text-muted-foreground">
              The requested tool could not be found.
            </p>
            <Link href="/">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href={`/tools/${tool.id}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" data-testid="text-execute-title">
                Execute: {tool.name}
              </h1>
              <Badge variant={tool.isActive ? "default" : "secondary"}>
                {tool.isActive ? "Active" : "Inactive"}
              </Badge>
              {tool.useFakeResponse && (
                <Badge variant="outline">Fake Response</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Parameters</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={generateSampleParams}
                data-testid="button-generate-sample"
              >
                Generate Sample
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="font-mono text-sm min-h-64"
                placeholder='{"param1": "value1", "param2": "value2"}'
                value={paramsJson}
                onChange={(e) => {
                  setParamsJson(e.target.value);
                  setParamsError(null);
                }}
                data-testid="input-execute-params"
              />
              {paramsError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {paramsError}
                </p>
              )}
              <Button
                className="w-full gap-2"
                onClick={handleExecute}
                disabled={isExecuting}
                data-testid="button-execute"
              >
                <Play className="h-4 w-4" />
                {isExecuting ? "Executing..." : "Execute Tool"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expected Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(tool.parameters.properties).map(([name, schema]) => (
                  <div key={name} className="flex items-start gap-2">
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {name}
                    </code>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {schema.type}
                        </Badge>
                        {tool.parameters.required?.includes(name) && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      {schema.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {schema.description}
                        </p>
                      )}
                      {schema.enum && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Allowed: {schema.enum.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Result</CardTitle>
              {result && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyResult}
                  data-testid="button-copy-result"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Execute the tool to see results</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "Success" : "Error"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {result.executionTime}ms
                    </div>
                  </div>
                  
                  {result.error ? (
                    <div className="p-4 bg-destructive/10 rounded-md border border-destructive/20">
                      <p className="text-sm text-destructive font-mono" data-testid="text-error-message">
                        {result.error}
                      </p>
                    </div>
                  ) : (
                    <pre className="font-mono text-sm p-4 bg-muted rounded-md overflow-auto max-h-96">
                      <code data-testid="text-result">
                        {JSON.stringify(result.result, null, 2)}
                      </code>
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">API Call Example</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="font-mono text-sm p-4 bg-muted rounded-md overflow-auto">
                <code>{`curl -X POST \\
  "https://your-app.repl.co/<api-key>/tools/${tool.name}" \\
  -H "Content-Type: application/json" \\
  -d '${paramsJson.replace(/\n/g, "").replace(/\s+/g, " ")}'`}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
