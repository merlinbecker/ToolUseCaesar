import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, LayoutDashboard, Plus, Settings, Zap, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tool } from "@shared/schema";

interface AppSidebarProps {
  tools: Tool[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
}

export function AppSidebar({ tools, searchQuery, onSearchChange, isLoading }: AppSidebarProps) {
  const [location] = useLocation();

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = tools.filter((t) => t.isActive).length;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Caesar 2</h1>
            <p className="text-xs text-muted-foreground">Tool Management</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search-tools"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/" data-testid="link-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/new"}>
                  <Link href="/new" data-testid="link-new-tool">
                    <Plus className="h-4 w-4" />
                    <span>New Tool</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings"}>
                  <Link href="/settings" data-testid="link-settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between gap-2">
            <span>Tools</span>
            <Badge variant="secondary" className="text-xs">
              {activeCount}/{tools.length}
            </Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading tools...
                </div>
              ) : filteredTools.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No tools found" : "No tools yet"}
                </div>
              ) : (
                filteredTools.map((tool) => (
                  <SidebarMenuItem key={tool.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === `/tools/${tool.id}`}
                    >
                      <Link
                        href={`/tools/${tool.id}`}
                        data-testid={`link-tool-${tool.id}`}
                      >
                        <Box className="h-4 w-4" />
                        <span className="flex-1 truncate">{tool.name}</span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            tool.isActive ? "bg-green-500" : "bg-muted-foreground"
                          }`}
                        />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Link href="/new">
          <Button className="w-full gap-2" data-testid="button-create-tool-sidebar">
            <Plus className="h-4 w-4" />
            Create Tool
          </Button>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
