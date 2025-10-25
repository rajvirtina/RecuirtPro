/**
 * Preload Script
 * Exposes safe APIs from main process to renderer process
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Monitoring control
  startMonitoring: (config: any) => ipcRenderer.invoke('start-monitoring', config),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // Event listeners
  onViolationDetected: (callback: (violation: any) => void) => {
    ipcRenderer.on('violation-detected', (_event: IpcRendererEvent, violation: any) => callback(violation));
  },
  onCriticalWarning: (callback: (warning: any) => void) => {
    ipcRenderer.on('show-critical-warning', (_event: IpcRendererEvent, warning: any) => callback(warning));
  },
  onUpdateStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('update-status', (_event: IpcRendererEvent, status: any) => callback(status));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      startMonitoring: (config: {
        apiUrl: string;
        token: string;
        interviewId: string;
        candidateId: string;
      }) => Promise<{ success: boolean; error?: string }>;
      stopMonitoring: () => Promise<{ success: boolean; error?: string }>;
      getConfig: () => Promise<{
        apiUrl: string;
        interviewId: string;
        candidateId: string;
        monitoringEnabled: boolean;
      }>;
      getSystemInfo: () => Promise<{
        platform: string;
        arch: string;
        version: string;
        electron: string;
        node: string;
      }>;
      onViolationDetected: (callback: (violation: any) => void) => void;
      onCriticalWarning: (callback: (warning: any) => void) => void;
      onUpdateStatus: (callback: (status: any) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
