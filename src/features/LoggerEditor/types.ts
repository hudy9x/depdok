export interface LogEntry {
  id: string;
  level: string;
  message: string;
  data?: any;
  timestamp: string;
}
