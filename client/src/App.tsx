import { useState } from "react";
import { Switch, Route, useLocation, useRoute, Redirect } from "wouter";
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
import { ChainsDashboard } from "@/pages/chains-dashboard";
import { ChainEditor } from "@/pages/chain-editor";
import { ChainExecute } from "@/pages/chain-execute";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import type { Tool, InsertTool, ToolExecutionResult, ToolChain, InsertChain, ChainExecutionResult } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from "lucide-react";

type AuthUser = { id: string; username: string };

function DashboardPage() {
  const { toast } = useToast();

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
        httpConfig: tool.httpConfig ?? undefined,
        preprocessing: tool.preprocessing ?? undefined,
        postprocessing: tool.postprocessing ?? undefined,
        fakeResponse: tool.fakeResponse ?? undefined,
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

  const { data: apiKeyData } = useQuery<{ key: string }>({
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

function ChainsDashboardPage() {
  const { toast } = useToast();

  const { data: chains = [], isLoading: isLoadingChains } = useQuery<ToolChain[]>({
    queryKey: ["/api/chains"],
  });

  const { data: tools = [] } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ chainId, isActive }: { chainId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/chains/${chainId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update chain status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (chainId: string) => {
      return apiRequest("DELETE", `/api/chains/${chainId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
      toast({ title: "Success", description: "Chain deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete chain", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (chain: ToolChain) => {
      const newChain: InsertChain = {
        name: `${chain.name}_copy`,
        description: chain.description,
        steps: chain.steps,
        isActive: false,
      };
      return apiRequest("POST", "/api/chains", newChain);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
      toast({ title: "Success", description: "Chain duplicated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate chain", variant: "destructive" });
    },
  });

  return (
    <ChainsDashboard
      chains={chains}
      tools={tools}
      isLoading={isLoadingChains}
      onToggleActive={(chainId, isActive) => toggleActiveMutation.mutate({ chainId, isActive })}
      onDeleteChain={(chainId) => deleteMutation.mutate(chainId)}
      onDuplicateChain={(chain) => duplicateMutation.mutate(chain)}
    />
  );
}

function NewChainPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: tools = [] } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertChain): Promise<ToolChain> => {
      const response = await apiRequest("POST", "/api/chains", data);
      return response.json();
    },
    onSuccess: (data: ToolChain) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
      toast({ title: "Success", description: "Chain created" });
      setLocation(`/chains/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create chain", variant: "destructive" });
    },
  });

  return (
    <ChainEditor
      tools={tools}
      onSave={(data) => createMutation.mutate(data)}
      isSaving={createMutation.isPending}
      isNew
    />
  );
}

function EditChainPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/chains/:id");
  const [, setLocation] = useLocation();
  const chainId = params?.id;

  const { data: chain, isLoading } = useQuery<ToolChain>({
    queryKey: ["/api/chains", chainId],
    enabled: !!chainId,
  });

  const { data: tools = [] } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertChain) => {
      return apiRequest("PUT", `/api/chains/${chainId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chains", chainId] });
      toast({ title: "Success", description: "Chain updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update chain", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <ChainEditor
      chain={chain}
      tools={tools}
      onSave={(data) => updateMutation.mutate(data)}
      onExecute={(id) => setLocation(`/chains/${id}/execute`)}
      isSaving={updateMutation.isPending}
    />
  );
}

function ExecuteChainPage() {
  const [, params] = useRoute("/chains/:id/execute");
  const chainId = params?.id;
  const [result, setResult] = useState<ChainExecutionResult | undefined>();

  const { data: chain, isLoading } = useQuery<ToolChain>({
    queryKey: ["/api/chains", chainId],
    enabled: !!chainId,
  });

  const { data: tools = [] } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
  });

  const executeMutation = useMutation({
    mutationFn: async (parameters: Record<string, unknown>): Promise<ChainExecutionResult> => {
      const response = await apiRequest("POST", `/api/chains/${chainId}/execute`, { parameters });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
    },
    onError: (error: Error) => {
      setResult({
        success: false,
        results: [],
        totalExecutionTime: 0,
        error: error.message,
      });
    },
  });

  return (
    <ChainExecute
      chain={chain}
      tools={tools}
      isLoading={isLoading}
      onExecute={(params) => executeMutation.mutate(params)}
      isExecuting={executeMutation.isPending}
      result={result}
    />
  );
}

function ProtectedRoutes() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/new" component={NewToolPage} />
      <Route path="/tools/:id" component={EditToolPage} />
      <Route path="/tools/:id/execute" component={ExecuteToolPage} />
      <Route path="/chains" component={ChainsDashboardPage} />
      <Route path="/chains/new" component={NewChainPage} />
      <Route path="/chains/:id" component={EditChainPage} />
      <Route path="/chains/:id/execute" component={ExecuteChainPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isLoadingUser } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: tools = [], isLoading: isLoadingTools } = useQuery<Tool[]>({
    queryKey: ["/api/tools"],
    enabled: !!user,
  });

  const { data: chains = [] } = useQuery<ToolChain[]>({
    queryKey: ["/api/chains"],
    enabled: !!user,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "Logged out", description: "See you next time!" });
      setLocation("/login");
    },
  });

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          tools={tools}
          chains={chains}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={isLoadingTools}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-2 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                <span data-testid="text-username">{user.username}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <ProtectedRoutes />
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
