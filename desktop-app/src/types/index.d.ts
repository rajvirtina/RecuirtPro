/**
 * Type definitions for desktop app
 */

// Window API exposed by preload
declare global {
  interface Window {
    electronAPI: {
      startMonitoring: (config: MonitoringConfig) => Promise<{ success: boolean; message?: string; error?: string }>;
      stopMonitoring: () => Promise<{ success: boolean; message?: string; error?: string }>;
      getSystemInfo: () => Promise<SystemInfo>;
      getConfig: () => Promise<any>;
      onViolationDetected: (callback: (violation: Violation) => void) => void;
      onCriticalWarning: (callback: (warning: Warning) => void) => void;
      onUpdateStatus: (callback: (status: Status) => void) => void;
    };
  }
}

export interface MonitoringConfig {
  apiUrl: string;
  token: string;
  interviewId: string;
  candidateId: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  version: string;
  electron?: string;
  node?: string;
}

export interface Violation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Warning {
  title: string;
  message: string;
  severity: 'warning' | 'critical';
  remainingWarnings?: number;
}

export interface Status {
  status: 'idle' | 'monitoring' | 'terminated' | 'error';
  message: string;
  reason?: string;
}
