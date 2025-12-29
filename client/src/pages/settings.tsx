import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, RefreshCw, Key, Server, Code, Users, Plus, Trash2 } from "lucide-react";
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

interface UserInfo {
  id: string;
  username: string;
  createdAt: string;
}

interface SettingsProps {
  apiKey: string;
  onRegenerateKey: () => void;
  isRegenerating: boolean;
  users?: UserInfo[];
  currentUserId?: string;
  onCreateUser?: (username: string, password: string) => void;
  onDeleteUser?: (userId: string) => void;
  isCreatingUser?: boolean;
}

export function Settings({ 
  apiKey, 
  onRegenerateKey, 
  isRegenerating,
  users = [],
  currentUserId,
  onCreateUser,
  onDeleteUser,
  isCreatingUser,
}: SettingsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateUser = () => {
    if (newUsername && newPassword && onCreateUser) {
      onCreateUser(newUsername, newPassword);
      setNewUsername("");
      setNewPassword("");
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-app.repl.co";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-settings-title">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your API key, users, and integration settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">User Management</CardTitle>
          </div>
          <CardDescription>
            Create and manage user accounts for this application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              data-testid="input-new-username"
            />
            <Input
              type="password"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="input-new-password"
            />
            <Button
              onClick={handleCreateUser}
              disabled={!newUsername || !newPassword || isCreatingUser}
              data-testid="button-create-user"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isCreatingUser ? "Creating..." : "Add User"}
            </Button>
          </div>

          {users.length > 0 && (
            <div className="border rounded-md divide-y">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium" data-testid={`text-user-${user.id}`}>
                      {user.username}
                    </span>
                    {user.id === currentUserId && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                    {user.id !== currentUserId && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete user "{user.username}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteUser?.(user.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">API Key</CardTitle>
          </div>
          <CardDescription>
            Your API key is required for all API calls. Include it in the URL path for authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={apiKey}
              readOnly
              className="font-mono"
              data-testid="input-api-key"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(apiKey, "apiKey")}
              data-testid="button-copy-api-key"
            >
              {copied === "apiKey" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onRegenerateKey}
              disabled={isRegenerating}
              data-testid="button-regenerate-key"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Keep your API key secure. Regenerating will invalidate the current key.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">API Endpoints</CardTitle>
          </div>
          <CardDescription>
            Use these endpoints to integrate with LLM agents and external systems.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              List Active Tools (MCP Server)
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm flex items-center gap-2 overflow-auto">
                <Badge variant="secondary">GET</Badge>
                <span>{baseUrl}/<span className="text-primary">{apiKey}</span>/tools</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(`${baseUrl}/${apiKey}/tools`, "listTools")}
                data-testid="button-copy-list-endpoint"
              >
                {copied === "listTools" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Returns all active tools in Mistral function call format for agent integration.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Execute Tool
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm flex items-center gap-2 overflow-auto">
                <Badge variant="secondary">POST</Badge>
                <span>{baseUrl}/<span className="text-primary">{apiKey}</span>/tools/<span className="text-muted-foreground">{"<tool_name>"}</span></span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(`${baseUrl}/${apiKey}/tools/<tool_name>`, "executeTool")}
                data-testid="button-copy-execute-endpoint"
              >
                {copied === "executeTool" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Execute a specific tool by name. Send parameters as JSON in the request body.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Integration Examples</CardTitle>
          </div>
          <CardDescription>
            Example code for integrating with your tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fetch Active Tools (JavaScript)
            </Label>
            <pre className="p-4 bg-muted rounded-md font-mono text-sm overflow-auto">
              <code>{`const response = await fetch("${baseUrl}/${apiKey}/tools");
const tools = await response.json();
// tools is an array of Mistral function definitions`}</code>
            </pre>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Execute Tool (JavaScript)
            </Label>
            <pre className="p-4 bg-muted rounded-md font-mono text-sm overflow-auto">
              <code>{`const response = await fetch("${baseUrl}/${apiKey}/tools/get_weather", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ location: "Berlin" })
});
const result = await response.json();`}</code>
            </pre>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              cURL Example
            </Label>
            <pre className="p-4 bg-muted rounded-md font-mono text-sm overflow-auto">
              <code>{`# List tools
curl "${baseUrl}/${apiKey}/tools"

# Execute tool
curl -X POST "${baseUrl}/${apiKey}/tools/get_weather" \\
  -H "Content-Type: application/json" \\
  -d '{"location": "Berlin"}'`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
