import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import type { ToolChain, Tool, ChainExecutionResult } from "@shared/schema";

interface ChainExecuteProps {
  chain?: ToolChain;
  tools: Tool[];
  isLoading: boolean;
  onExecute: (params: Record<string, unknown>) => void;
  isExecuting: boolean;
  result?: ChainExecutionResult;
}

export function ChainExecute({
  chain,
  tools,
  isLoading,
  onExecute,
  isExecuting,
  result,
}: ChainExecuteProps) {
  const [, setLocation] = useLocation();
  const [inputParams, setInputParams] = useState("{}");
  const [parseError, setParseError] = useState<string | null>(null);

  const getToolName = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    return tool?.name || "unknown";
  };

  const handleExecute = () => {
    try {
      const params = JSON.parse(inputParams);
      setParseError(null);
      onExecute(params);
    } catch (e) {
      setParseError("Invalid JSON format");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading chain...</div>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Chain not found</h2>
          <Button variant="outline" onClick={() => setLocation("/chains")}>
            Back to Chains
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/chains/${chain.id}`)}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-chain-execute-title">
            Execute: {chain.name}
          </h1>
          <p className="text-muted-foreground text-sm">{chain.description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chain Steps</CardTitle>
          <CardDescription>This chain will execute the following tools in sequence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {chain.steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge
                  variant={
                    result?.results[idx]?.success === true
                      ? "default"
                      : result?.results[idx]?.success === false
                      ? "destructive"
                      : "outline"
                  }
                  className="text-sm py-1 px-3"
                >
                  {idx + 1}. {getToolName(step.toolId)}
                  {result?.results[idx] && (
                    result.results[idx].success
                      ? <CheckCircle className="h-3 w-3 ml-1 inline" />
                      : <XCircle className="h-3 w-3 ml-1 inline" />
                  )}
                </Badge>
                {idx < chain.steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Initial Parameters</CardTitle>
          <CardDescription>
            Provide JSON input for the first step of the chain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Input Parameters (JSON)</Label>
            <Textarea
              value={inputParams}
              onChange={(e) => setInputParams(e.target.value)}
              className={`font-mono text-sm min-h-[120px] ${parseError ? "border-destructive" : ""}`}
              placeholder='{}'
              data-testid="input-chain-params"
            />
            {parseError && <p className="text-destructive text-sm">{parseError}</p>}
          </div>
          
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            data-testid="button-execute-chain"
          >
            <Play className="h-4 w-4 mr-1" />
            {isExecuting ? "Executing..." : "Execute Chain"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Execution Result
                  {result.success ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  Total time: {result.totalExecutionTime}ms
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.results.map((stepResult, idx) => (
              <Card key={idx} className={stepResult.success ? "" : "border-destructive"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      Step {stepResult.stepIndex + 1}: {stepResult.toolName}
                      {stepResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {stepResult.executionTime}ms
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {stepResult.error ? (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm font-mono">
                      {stepResult.error}
                    </div>
                  ) : (
                    <pre className="bg-muted p-3 rounded-md text-sm font-mono overflow-auto max-h-48">
                      {JSON.stringify(stepResult.result, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))}

            {result.error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                <strong>Chain Error:</strong> {result.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
