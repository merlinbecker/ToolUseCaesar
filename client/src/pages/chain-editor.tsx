import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, GripVertical, ArrowRight, Save, Play } from "lucide-react";
import type { ToolChain, InsertChain, Tool, ChainStep } from "@shared/schema";

interface ChainEditorProps {
  chain?: ToolChain;
  tools: Tool[];
  onSave: (data: InsertChain) => void;
  onExecute?: (id: string) => void;
  isSaving: boolean;
  isNew?: boolean;
}

interface StepConfig extends ChainStep {
  localId: string;
}

export function ChainEditor({ chain, tools, onSave, onExecute, isSaving, isNew }: ChainEditorProps) {
  const [, setLocation] = useLocation();
  const [name, setName] = useState(chain?.name || "");
  const [description, setDescription] = useState(chain?.description || "");
  const [isActive, setIsActive] = useState(chain?.isActive ?? true);
  const [steps, setSteps] = useState<StepConfig[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (chain?.steps && steps.length === 0) {
      setSteps(chain.steps.map((step, idx) => ({
        ...step,
        continueOnError: step.continueOnError ?? false,
        localId: `step-${idx}-${Date.now()}`,
      })));
    }
  }, [chain?.steps]);

  const addStep = () => {
    setSteps([...steps, {
      localId: `step-${Date.now()}`,
      toolId: "",
      inputMapping: {},
      continueOnError: false,
    }]);
  };

  const removeStep = (localId: string) => {
    setSteps(steps.filter(s => s.localId !== localId));
  };

  const updateStep = (localId: string, updates: Partial<StepConfig>) => {
    setSteps(steps.map(s => s.localId === localId ? { ...s, ...updates } : s));
  };

  const updateInputMapping = (localId: string, key: string, value: string) => {
    setSteps(steps.map(s => {
      if (s.localId !== localId) return s;
      const newMapping = { ...s.inputMapping, [key]: value };
      if (!value) delete newMapping[key];
      return { ...s, inputMapping: newMapping };
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (!/^[a-z_][a-z0-9_-]*$/i.test(name)) {
      newErrors.name = "Name must be alphanumeric with underscores or hyphens";
    }
    
    if (!description.trim()) {
      newErrors.description = "Description is required";
    }
    
    if (steps.length === 0) {
      newErrors.steps = "At least one step is required";
    }
    
    steps.forEach((step, idx) => {
      if (!step.toolId) {
        newErrors[`step-${idx}`] = "Tool is required";
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
    const chainData: InsertChain = {
      name,
      description,
      isActive,
      steps: steps.map(({ toolId, inputMapping, continueOnError }) => ({
        toolId,
        inputMapping: Object.keys(inputMapping || {}).length > 0 ? inputMapping : undefined,
        continueOnError: continueOnError ?? false,
      })),
    };
    
    onSave(chainData);
  };

  const getToolById = (id: string) => tools.find(t => t.id === id);

  const getPreviousStepOutputs = (stepIndex: number): string[] => {
    if (stepIndex === 0) return [];
    const prevStep = steps[stepIndex - 1];
    if (!prevStep?.toolId) return [];
    const prevTool = getToolById(prevStep.toolId);
    if (!prevTool?.fakeResponse) return [];
    try {
      const response = JSON.parse(prevTool.fakeResponse);
      return Object.keys(response);
    } catch {
      return [];
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/chains")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-chain-editor-title">
            {isNew ? "Create Chain" : `Edit: ${chain?.name || ""}`}
          </h1>
          <p className="text-muted-foreground text-sm">
            Chain multiple tools together for complex workflows
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chain Configuration</CardTitle>
          <CardDescription>Define the chain metadata and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chain-name">Name</Label>
              <Input
                id="chain-name"
                data-testid="input-chain-name"
                placeholder="my_workflow_chain"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
            </div>
            <div className="flex items-center gap-3 pt-7">
              <Switch
                id="chain-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-chain-active"
              />
              <Label htmlFor="chain-active">Active</Label>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="chain-description">Description</Label>
            <Textarea
              id="chain-description"
              data-testid="input-chain-description"
              placeholder="Describe what this chain does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && <p className="text-destructive text-sm">{errors.description}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Chain Steps</CardTitle>
            <CardDescription>Define the sequence of tools to execute</CardDescription>
          </div>
          <Button onClick={addStep} size="sm" data-testid="button-add-step">
            <Plus className="h-4 w-4 mr-1" /> Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.steps && <p className="text-destructive text-sm">{errors.steps}</p>}
          
          {steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No steps added yet. Click "Add Step" to begin building your chain.
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const selectedTool = getToolById(step.toolId);
                const prevOutputs = getPreviousStepOutputs(idx);
                const toolParams = selectedTool?.parameters?.properties || {};
                
                return (
                  <Card key={step.localId} className="border-l-4 border-l-primary">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <Select
                            value={step.toolId}
                            onValueChange={(value) => updateStep(step.localId, { toolId: value })}
                          >
                            <SelectTrigger 
                              className={`w-64 ${errors[`step-${idx}`] ? "border-destructive" : ""}`}
                              data-testid={`select-step-tool-${idx}`}
                            >
                              <SelectValue placeholder="Select a tool" />
                            </SelectTrigger>
                            <SelectContent>
                              {tools.map(tool => (
                                <SelectItem key={tool.id} value={tool.id}>
                                  {tool.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors[`step-${idx}`] && (
                            <p className="text-destructive text-sm mt-1">{errors[`step-${idx}`]}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={step.continueOnError}
                            onCheckedChange={(checked) => updateStep(step.localId, { continueOnError: checked })}
                            data-testid={`switch-continue-on-error-${idx}`}
                          />
                          <span className="text-muted-foreground">Continue on error</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStep(step.localId)}
                          data-testid={`button-remove-step-${idx}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    
                    {selectedTool && idx > 0 && Object.keys(toolParams).length > 0 && (
                      <CardContent className="pt-0">
                        <div className="text-sm font-medium mb-2">Input Mappings</div>
                        <div className="text-xs text-muted-foreground mb-3">
                          Map outputs from previous step to this tool's parameters using $.fieldName syntax
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(toolParams).map(([paramKey, paramDef]) => (
                            <div key={paramKey} className="flex items-center gap-2">
                              <Label className="w-32 text-sm truncate" title={paramKey}>
                                {paramKey}
                              </Label>
                              <Input
                                placeholder={`$.${prevOutputs[0] || "field"}`}
                                value={step.inputMapping?.[paramKey] || ""}
                                onChange={(e) => updateInputMapping(step.localId, paramKey, e.target.value)}
                                className="flex-1 text-sm"
                                data-testid={`input-mapping-${idx}-${paramKey}`}
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                    
                    {idx < steps.length - 1 && (
                      <div className="flex justify-center py-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {!isNew && chain && (
          <Button
            variant="outline"
            onClick={() => onExecute?.(chain.id)}
            data-testid="button-test-chain"
          >
            <Play className="h-4 w-4 mr-1" /> Test Chain
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="button-save-chain"
        >
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving..." : "Save Chain"}
        </Button>
      </div>
    </div>
  );
}
