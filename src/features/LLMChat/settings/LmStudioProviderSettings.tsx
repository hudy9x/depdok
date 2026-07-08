import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LmStudioProviderSettingsProps {
  apiEndpoint: string;
  modelName: string;
  onApiEndpointChange: (value: string) => void;
  onModelNameChange: (value: string) => void;
}

export function LmStudioProviderSettings({
  apiEndpoint,
  modelName,
  onApiEndpointChange,
  onModelNameChange,
}: LmStudioProviderSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">LM Studio Endpoint</Label>
        <Input
          placeholder="http://localhost:1234"
          value={apiEndpoint}
          onChange={(e) => onApiEndpointChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Model Name (optional)</Label>
        <Input
          placeholder="Leave blank to use the active model"
          value={modelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
    </div>
  );
}
