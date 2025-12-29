import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Link2, Play, Trash2, Copy, ArrowRight } from "lucide-react";
import type { ToolChain, Tool } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ChainsDashboardProps {
  chains: ToolChain[];
  tools: Tool[];
  isLoading: boolean;
  onToggleActive: (chainId: string, isActive: boolean) => void;
  onDeleteChain: (chainId: string) => void;
  onDuplicateChain: (chain: ToolChain) => void;
}

export function ChainsDashboard({
  chains,
  tools,
  isLoading,
  onToggleActive,
  onDeleteChain,
  onDuplicateChain,
}: ChainsDashboardProps) {
  const activeCount = chains.filter(c => c.isActive).length;
  const totalExecutions = chains.reduce((sum, c) => sum + c.executionCount, 0);

  const getToolName = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    return tool?.name || "unknown";
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading chains...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-chains-title">Tool Chains</h1>
          <p className="text-muted-foreground text-sm">
            Combine multiple tools into sequential workflows
          </p>
        </div>
        <Link href="/chains/new">
          <Button data-testid="button-create-chain">
            <Plus className="h-4 w-4 mr-1" /> New Chain
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Chains</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-total-chains">
              {chains.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Chains</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-active-chains">
              {activeCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Executions</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-chain-executions">
              {totalExecutions}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {chains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No chains yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first chain to combine multiple tools into powerful workflows.
            </p>
            <Link href="/chains/new">
              <Button data-testid="button-create-first-chain">
                <Plus className="h-4 w-4 mr-1" /> Create Your First Chain
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {chains.map(chain => (
            <Card
              key={chain.id}
              className="hover-elevate transition-all"
              data-testid={`card-chain-${chain.id}`}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/chains/${chain.id}`}>
                      <CardTitle
                        className="text-lg hover:underline cursor-pointer truncate"
                        data-testid={`text-chain-name-${chain.id}`}
                      >
                        {chain.name}
                      </CardTitle>
                    </Link>
                    <Badge variant={chain.isActive ? "default" : "secondary"} className="shrink-0">
                      {chain.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {chain.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={chain.isActive}
                    onCheckedChange={(checked) => onToggleActive(chain.id, checked)}
                    data-testid={`switch-chain-active-${chain.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {chain.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {getToolName(step.toolId)}
                      </Badge>
                      {idx < chain.steps.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {chain.steps.length} steps | {chain.executionCount} executions
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href={`/chains/${chain.id}/execute`}>
                      <Button variant="ghost" size="icon" data-testid={`button-execute-chain-${chain.id}`}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDuplicateChain(chain)}
                      data-testid={`button-duplicate-chain-${chain.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-delete-chain-${chain.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Chain</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{chain.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteChain(chain.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
