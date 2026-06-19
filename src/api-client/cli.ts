import { invoke } from '@tauri-apps/api/core';

export interface PendingPath {
  path: string;
  is_dir: boolean;
  exists: boolean;
}

/** Get list of paths passed as command line arguments on startup */
export const getPendingOpenPaths = (): Promise<PendingPath[]> =>
  invoke('get_pending_open_paths');

/** Install the 'depdok' CLI shim and register it to user's PATH */
export const installCli = (): Promise<void> =>
  invoke('install_cli');

/** Uninstall the 'depdok' CLI shim and remove it from user's PATH */
export const uninstallCli = (): Promise<void> =>
  invoke('uninstall_cli');

export interface CliInfo {
  is_installed: boolean;
  cli_path: string;
}

/** Get the installation status and target environment path of the 'depdok' CLI command */
export const getCliInfo = (): Promise<CliInfo> =>
  invoke('get_cli_info');
