import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OpenAiProviderSettingsProps {
  apiKey: string;
  modelName: string;
  apiEndpoint: string;
  onApiKeyChange: (value: string) => void;
  onModelNameChange: (value: string) => void;
  onApiEndpointChange: (value: string) => void;
}

export function OpenAiProviderSettings({
  apiKey,
  modelName,
  apiEndpoint,
  onApiKeyChange,
  onModelNameChange,
  onApiEndpointChange,
}: OpenAiProviderSettingsProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">API Key</Label>
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            className="text-xs h-8 pr-9"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 cursor-pointer"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Model</Label>
        <Input
          placeholder="gpt-4o"
          value={modelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Custom Endpoint (optional)</Label>
        <Input
          placeholder="https://api.openai.com"
          value={apiEndpoint}
          onChange={(e) => onApiEndpointChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
    </div>
  );
}
