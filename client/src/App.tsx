import { useState } from "react";
import { Switch, Route, useLocation, useRoute } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { Dashboard } from "@/pages/dashboard";
import { ToolEditor } from "@/pages/tool-editor";
import { ToolExecute } from "@/pages/tool-execute";
import { Settings } from "@/pages/settings";
import NotFound from "@/pages/not-found";
import type { Tool, InsertTool, ToolExecutionResult } from "@shared/schema";

function DashboardPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ toolId, isActive }: { toolId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/tools/${toolId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tool status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (toolId: string) => {
      return apiRequest("DELETE", `/api/tools/${toolId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      toast({ title: "Success", description: "Tool deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete tool", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (tool: Tool) => {
      const newTool: InsertTool = {
        name: `${tool.name}_copy`,
        description: tool.description,
        parameters: tool.parameters,
        httpConfig: tool.httpConfig,
        preprocessing: tool.preprocessing,
        postprocessing: tool.postprocessing,
        fakeResponse: tool.fakeResponse,
        useFakeResponse: tool.useFakeResponse,
        isActive: false,
      };
      return apiRequest("POST", "/api/tools", newTool);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      toast({ title: "Success", description: "Tool duplicated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate tool", variant: "destructive" });
    },
  });

  return (
    <Dashboard
      tools={tools}
      isLoading={isLoading}
      onToggleActive={(toolId, isActive) => toggleActiveMutation.mutate({ toolId, isActive })}
      onDeleteTool={(toolId) => deleteMutation.mutate(toolId)}
      onDuplicateTool={(tool) => duplicateMutation.mutate(tool)}
    />
  );
}

function NewToolPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createMutation = useMutation({
    mutationFn: async (data: InsertTool): Promise<Tool> => {
      const response = await apiRequest("POST", "/api/tools", data);
      return response.json();
    },
    onSuccess: (data: Tool) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      toast({ title: "Success", description: "Tool created" });
      setLocation(`/tools/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create tool", variant: "destructive" });
    },
  });

  return (
    <ToolEditor
      onSave={(data) => createMutation.mutate(data)}
      onExecute={() => {}}
      isSaving={createMutation.isPending}
      isNew
    />
  );
}

function EditToolPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/tools/:id");
  const [, setLocation] = useLocation();
  const toolId = params?.id;

  const { data: tool, isLoading } = useQuery<Tool>({
    queryKey: ["/api/tools", toolId],
    enabled: !!toolId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertTool) => {
      return apiRequest("PUT", `/api/tools/${toolId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tools", toolId] });
      toast({ title: "Success", description: "Tool updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tool", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <ToolEditor
      tool={tool}
      onSave={(data) => updateMutation.mutate(data)}
      onExecute={(id) => setLocation(`/tools/${id}/execute`)}
      isSaving={updateMutation.isPending}
    />
  );
}

function ExecuteToolPage() {
  const [, params] = useRoute("/tools/:id/execute");
  const toolId = params?.id;
  const [result, setResult] = useState<ToolExecutionResult | undefined>();

  const { data: tool, isLoading } = useQuery<Tool>({
    queryKey: ["/api/tools", toolId],
    enabled: !!toolId,
  });

  const executeMutation = useMutation({
    mutationFn: async (parameters: Record<string, unknown>): Promise<ToolExecutionResult> => {
      const response = await apiRequest("POST", `/api/tools/${toolId}/execute`, { parameters });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
    },
    onError: (error: Error) => {
      setResult({
        success: false,
        error: error.message,
        executionTime: 0,
      });
    },
  });

  return (
    <ToolExecute
      tool={tool}
      isLoading={isLoading}
      onExecute={(params) => executeMutation.mutate(params)}
      isExecuting={executeMutation.isPending}
      result={result}
    />
  );
}

function SettingsPage() {
  const { toast } = useToast();

  const { data: apiKeyData, isLoading } = useQuery<{ key: string }>({
    queryKey: ["/api/settings/api-key"],
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/api-key/regenerate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-key"] });
      toast({ title: "Success", description: "API key regenerated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to regenerate API key", variant: "destructive" });
    },
  });

  return (
    <Settings
      apiKey={apiKeyData?.key || "loading..."}
      onRegenerateKey={() => regenerateMutation.mutate()}
      isRegenerating={regenerateMutation.isPending}
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/new" component={NewToolPage} />
      <Route path="/tools/:id" component={EditToolPage} />
      <Route path="/tools/:id/execute" component={ExecuteToolPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tools = [], isLoading } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          tools={tools}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={isLoading}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-2 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
