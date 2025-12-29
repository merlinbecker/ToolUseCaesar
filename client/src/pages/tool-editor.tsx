import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronLeft, Save, Play, Copy, Check, AlertCircle } from "lucide-react";
import type { Tool, InsertTool } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-z_][a-z0-9_]*$/i, "Name must be alphanumeric with underscores"),
  description: z.string().min(1, "Description is required"),
  parametersJson: z.string().refine((val) => {
    try {
      const parsed = JSON.parse(val);
      return parsed.type === "object" && typeof parsed.properties === "object";
    } catch {
      return false;
    }
  }, "Must be a valid JSON Schema with type 'object' and 'properties'"),
  httpEndpoint: z.string().optional(),
  httpMethod: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  httpHeadersJson: z.string().optional(),
  httpBodyTemplate: z.string().optional(),
  preprocessing: z.string().optional(),
  postprocessing: z.string().optional(),
  fakeResponse: z.string().optional(),
  useFakeResponse: z.boolean(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface ToolEditorProps {
  tool?: Tool;
  onSave: (data: InsertTool) => void;
  onExecute: (toolId: string) => void;
  isSaving: boolean;
  isNew?: boolean;
}

const defaultParameters = JSON.stringify({
  type: "object",
  properties: {
    example_param: {
      type: "string",
      description: "An example parameter"
    }
  },
  required: ["example_param"]
}, null, 2);

export function ToolEditor({ tool, onSave, onExecute, isSaving, isNew = false }: ToolEditorProps) {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [mistralPreview, setMistralPreview] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tool?.name || "",
      description: tool?.description || "",
      parametersJson: tool ? JSON.stringify(tool.parameters, null, 2) : defaultParameters,
      httpEndpoint: tool?.httpConfig?.endpoint || "",
      httpMethod: tool?.httpConfig?.method || "POST",
      httpHeadersJson: tool?.httpConfig?.headers ? JSON.stringify(tool.httpConfig.headers, null, 2) : "{}",
      httpBodyTemplate: tool?.httpConfig?.bodyTemplate || "",
      preprocessing: tool?.preprocessing || "",
      postprocessing: tool?.postprocessing || "",
      fakeResponse: tool?.fakeResponse || "",
      useFakeResponse: tool?.useFakeResponse || false,
      isActive: tool?.isActive ?? true,
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    try {
      const params = JSON.parse(watchedValues.parametersJson || "{}");
      const mistralFormat = {
        type: "function",
        function: {
          name: watchedValues.name || "tool_name",
          description: watchedValues.description || "Tool description",
          parameters: params,
        },
      };
      setMistralPreview(JSON.stringify(mistralFormat, null, 2));
    } catch {
      setMistralPreview("Invalid parameters JSON");
    }
  }, [watchedValues.name, watchedValues.description, watchedValues.parametersJson]);

  const handleSubmit = (data: FormData) => {
    try {
      const parameters = JSON.parse(data.parametersJson);
      const headers = data.httpHeadersJson ? JSON.parse(data.httpHeadersJson) : {};

      const toolData: InsertTool = {
        name: data.name,
        description: data.description,
        parameters,
        httpConfig: {
          endpoint: data.httpEndpoint || "",
          method: data.httpMethod,
          headers,
          bodyTemplate: data.httpBodyTemplate,
        },
        preprocessing: data.preprocessing,
        postprocessing: data.postprocessing,
        fakeResponse: data.fakeResponse,
        useFakeResponse: data.useFakeResponse,
        isActive: data.isActive,
      };

      onSave(toolData);
    } catch (error) {
      console.error("Failed to parse form data:", error);
    }
  };

  const copyMistralFormat = () => {
    navigator.clipboard.writeText(mistralPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold" data-testid="text-editor-title">
                  {isNew ? "Create Tool" : `Edit: ${tool?.name}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isNew ? "Define a new tool for LLM agents" : "Modify tool configuration"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isNew && tool && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onExecute(tool.id)}
                  data-testid="button-test-tool"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Test
                </Button>
              )}
              <Button type="submit" disabled={isSaving} data-testid="button-save-tool">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Tool"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="get_weather"
                            {...field}
                            data-testid="input-tool-name"
                          />
                        </FormControl>
                        <FormDescription>
                          Alphanumeric with underscores, e.g. get_weather
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this tool does..."
                            className="min-h-20"
                            {...field}
                            data-testid="input-tool-description"
                          />
                        </FormControl>
                        <FormDescription>
                          A clear description helps LLMs understand when to use this tool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-tool-active"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Active</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="useFakeResponse"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-fake-response"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Use Fake Response</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parameters (JSON Schema)</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="parametersJson"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            className="font-mono text-sm min-h-48"
                            placeholder='{"type": "object", "properties": {...}}'
                            {...field}
                            data-testid="input-parameters-json"
                          />
                        </FormControl>
                        <FormDescription>
                          Define parameters using JSON Schema format for Mistral function calls
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">HTTP Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="httpMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-http-method">
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                              <SelectItem value="DELETE">DELETE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name="httpEndpoint"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endpoint URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://api.example.com/endpoint"
                                {...field}
                                data-testid="input-http-endpoint"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="httpHeadersJson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Headers (JSON)</FormLabel>
                        <FormControl>
                          <Textarea
                            className="font-mono text-sm min-h-20"
                            placeholder='{"Authorization": "Bearer token"}'
                            {...field}
                            data-testid="input-http-headers"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="httpBodyTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Template</FormLabel>
                        <FormControl>
                          <Textarea
                            className="font-mono text-sm min-h-20"
                            placeholder='{"query": "{{query}}", "limit": {{limit}}}'
                            {...field}
                            data-testid="input-http-body"
                          />
                        </FormControl>
                        <FormDescription>
                          Use {"{{param}}"} syntax to inject parameters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processing Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="preprocessing">
                    <TabsList>
                      <TabsTrigger value="preprocessing" data-testid="tab-preprocessing">
                        Pre-processing
                      </TabsTrigger>
                      <TabsTrigger value="postprocessing" data-testid="tab-postprocessing">
                        Post-processing
                      </TabsTrigger>
                      <TabsTrigger value="fakeresponse" data-testid="tab-fakeresponse">
                        Fake Response
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="preprocessing" className="mt-4">
                      <FormField
                        control={form.control}
                        name="preprocessing"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                className="font-mono text-sm min-h-64"
                                placeholder="// Transform input parameters before API call
// Available: params (input parameters)
// Return modified params object
function preprocess(params) {
  return params;
}"
                                {...field}
                                data-testid="input-preprocessing"
                              />
                            </FormControl>
                            <FormDescription>
                              JavaScript code to transform parameters before the API call
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    <TabsContent value="postprocessing" className="mt-4">
                      <FormField
                        control={form.control}
                        name="postprocessing"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                className="font-mono text-sm min-h-64"
                                placeholder="// Transform API response before returning
// Available: response (API response data)
// Return modified response object
function postprocess(response) {
  return response;
}"
                                {...field}
                                data-testid="input-postprocessing"
                              />
                            </FormControl>
                            <FormDescription>
                              JavaScript code to transform the response after the API call
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    <TabsContent value="fakeresponse" className="mt-4">
                      <FormField
                        control={form.control}
                        name="fakeResponse"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                className="font-mono text-sm min-h-64"
                                placeholder='{"result": "Example fake response", "status": "success"}'
                                {...field}
                                data-testid="input-fakeresponse"
                              />
                            </FormControl>
                            <FormDescription>
                              Static JSON response for testing without making real API calls
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-2 space-y-6">
              <Card className="sticky top-6">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg">Mistral Format Preview</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyMistralFormat}
                    data-testid="button-copy-mistral"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <pre className="font-mono text-sm p-4 bg-muted rounded-md overflow-auto max-h-96">
                    <code data-testid="text-mistral-preview">{mistralPreview}</code>
                  </pre>
                </CardContent>
              </Card>

              {!isNew && tool && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API Endpoint</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Execute Tool
                      </Label>
                      <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
                        <span className="text-muted-foreground">POST</span>{" "}
                        <span className="text-primary">{"/<api-key>"}</span>
                        <span>/tools/{tool.name}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        List Active Tools
                      </Label>
                      <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
                        <span className="text-muted-foreground">GET</span>{" "}
                        <span className="text-primary">{"/<api-key>"}</span>
                        <span>/tools</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {form.formState.errors.root && (
                <Card className="border-destructive">
                  <CardContent className="flex items-center gap-2 p-4 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{form.formState.errors.root.message}</span>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
