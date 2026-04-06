import { invoke } from '@tauri-apps/api/core';

export async function startLoggerServer(): Promise<string> {
  return await invoke('start_logger_server');
}

export async function registerLoggerChannel(channel: string, filePath: string): Promise<void> {
  return await invoke('register_logger_channel', { channel, filePath });
}
