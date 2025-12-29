import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, Play, Pencil, Trash2, Copy, Zap, Box, Activity } from "lucide-react";
import type { Tool } from "@shared/schema";

interface DashboardProps {
  tools: Tool[];
  isLoading: boolean;
  onToggleActive: (toolId: string, isActive: boolean) => void;
  onDeleteTool: (toolId: string) => void;
  onDuplicateTool: (tool: Tool) => void;
}

export function Dashboard({ tools, isLoading, onToggleActive, onDeleteTool, onDuplicateTool }: DashboardProps) {
  const activeCount = tools.filter((t) => t.isActive).length;
  const totalExecutions = tools.reduce((sum, t) => sum + t.executionCount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your LLM agent tools</p>
        </div>
        <Link href="/new">
          <Button className="gap-2" data-testid="button-create-tool">
            <Plus className="h-4 w-4" />
            New Tool
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-tools">{tools.length}</div>
            <p className="text-xs text-muted-foreground">Defined tools</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Tools</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-active-tools">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Available for agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-executions">{totalExecutions}</div>
            <p className="text-xs text-muted-foreground">All-time tool runs</p>
          </CardContent>
        </Card>
      </div>

      {tools.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Box className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No tools yet</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Create your first tool to get started. Tools can be called by LLM agents using Mistral-compatible function calls.
              </p>
            </div>
            <Link href="/new">
              <Button className="gap-2" data-testid="button-create-first-tool">
                <Plus className="h-4 w-4" />
                Create Your First Tool
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Card key={tool.id} data-testid={`card-tool-${tool.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-medium truncate">
                      {tool.name}
                    </CardTitle>
                    <Badge
                      variant={tool.isActive ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {tool.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1 line-clamp-2">
                    {tool.description}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-tool-menu-${tool.id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Link href={`/tools/${tool.id}`}>
                      <DropdownMenuItem data-testid={`menu-edit-${tool.id}`}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    </Link>
                    <Link href={`/tools/${tool.id}/execute`}>
                      <DropdownMenuItem data-testid={`menu-execute-${tool.id}`}>
                        <Play className="h-4 w-4 mr-2" />
                        Execute
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem
                      onClick={() => onDuplicateTool(tool)}
                      data-testid={`menu-duplicate-${tool.id}`}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteTool(tool.id)}
                      className="text-destructive"
                      data-testid={`menu-delete-${tool.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span>{tool.executionCount} runs</span>
                  </div>
                  {tool.useFakeResponse && (
                    <Badge variant="outline" className="text-xs">
                      Fake Response
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2 pt-0">
                <span className="text-xs text-muted-foreground">
                  Modified {formatDate(tool.lastModified)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={tool.isActive}
                    onCheckedChange={(checked) => onToggleActive(tool.id, checked)}
                    data-testid={`switch-active-${tool.id}`}
                  />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
