import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Play, Square, Trash2, Webhook, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface LoggerHeaderProps {
  channel: string;
  serverUrl: string;
  isServerRunning: boolean;
  onToggleServer: () => void;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  filterLevel: string;
  onFilterLevelChange: (level: string) => void;
  onClear: () => void;
  showMessageOnly: boolean;
  onShowMessageOnlyChange: (enabled: boolean) => void;
}

export function LoggerHeader({
  channel,
  serverUrl,
  isServerRunning,
  onToggleServer,
  filterText,
  onFilterTextChange,
  filterLevel,
  onFilterLevelChange,
  onClear,
  showMessageOnly,
  onShowMessageOnlyChange,
}: LoggerHeaderProps) {
  const [driver, setDriver] = useState("nodejs");
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  const fullUrl = serverUrl ? `${serverUrl}/${channel}` : `http://localhost:8080/${channel}`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setHasCopiedUrl(true);
    setTimeout(() => setHasCopiedUrl(false), 1500);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(currCode);
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 1500);
  };

  const nodeCode = `fetch('${fullUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    level: 'info',
    message: 'Hello from NodeJS!',
    timestamp: new Date().toISOString()
  })
}).catch(() => {});`;

  const pythonCode = `import urllib.request
import json
import datetime

data = json.dumps({
    "level": "info",
    "message": "Hello from Python!",
    "timestamp": datetime.datetime.now().isoformat()
}).encode('utf-8')

req = urllib.request.Request('${fullUrl}', data=data, headers={'Content-Type': 'application/json'}, method='POST')
try:
    urllib.request.urlopen(req)
except:
    pass
`;

  const currCode = driver === "nodejs" ? nodeCode : pythonCode;

  return (
    <div className="flex items-center justify-between p-2 pb-0 mb-2 border-b border-border text-sm">
      <div className="flex items-center gap-2 mb-2">
        <Button variant={isServerRunning ? "destructive" : "default"} size="sm" onClick={onToggleServer}>
          {isServerRunning ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
          {isServerRunning ? "Stop" : "Start"}
        </Button>
        <div className="flex items-center gap-1 bg-muted h-9 px-3 rounded text-xs select-auto">
          <span className="text-muted-foreground mr-1">URL:</span>
          <span>{fullUrl}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-2" onClick={handleCopyUrl}>
            {hasCopiedUrl ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Webhook className="w-4 h-4 mr-1" />
              Connect
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect with Driver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Select Driver:</span>
                <Select value={driver} onValueChange={setDriver}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nodejs">Node.js (Native)</SelectItem>
                    <SelectItem value="python">Python (Native)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto">
                  {currCode}
                </pre>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={handleCopyCode}
                >
                  {hasCopiedCode ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center space-x-2 mr-2">
          <Switch id="message-only" checked={showMessageOnly} onCheckedChange={onShowMessageOnlyChange} />
          <Label htmlFor="message-only" className="text-xs cursor-pointer">Message Only</Label>
        </div>
        <Select value={filterLevel} onValueChange={onFilterLevelChange}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-9 w-64"
          placeholder="Filter logs by text (comma-separated)..."
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
        />
      </div>
    </div>
  );
}
