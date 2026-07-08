import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OllamaProviderSettingsProps {
  apiEndpoint: string;
  modelName: string;
  onApiEndpointChange: (value: string) => void;
  onModelNameChange: (value: string) => void;
}

export function OllamaProviderSettings({
  apiEndpoint,
  modelName,
  onApiEndpointChange,
  onModelNameChange,
}: OllamaProviderSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Ollama Endpoint</Label>
        <Input
          placeholder="http://localhost:11434"
          value={apiEndpoint}
          onChange={(e) => onApiEndpointChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Model Name</Label>
        <Input
          placeholder="llama3, mistral, phi3..."
          value={modelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
    </div>
  );
}
