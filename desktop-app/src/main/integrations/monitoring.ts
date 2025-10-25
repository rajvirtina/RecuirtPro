/**
 * Monitoring Integration Layer
 * Connects all monitors with API and Socket clients for real-time violation reporting
 */

import { ProcessMonitor } from '../monitors/ProcessMonitor';
import { DisplayMonitor } from '../monitors/DisplayMonitor';
import { WindowMonitor } from '../monitors/WindowMonitor';
import { ApiClient } from '../services/ApiClient';
import { SocketClient } from '../services/SocketClient';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

interface MonitoringConfig {
  apiUrl: string;
  token: string;
  interviewId: string;
  mainWindow: BrowserWindow;
}

interface Violation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    processName?: string;
    count?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    details?: string;
  };
}

export class MonitoringIntegration {
  private processMonitor: ProcessMonitor | null = null;
  private displayMonitor: DisplayMonitor | null = null;
  private windowMonitor: WindowMonitor | null = null;
  private apiClient: ApiClient | null = null;
  private socketClient: SocketClient | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: MonitoringConfig | null = null;
  private isRunning: boolean = false;

  constructor() {}

  async start(config: MonitoringConfig) {
    if (this.isRunning) {
      log.warn('Monitoring already running');
      return;
    }

    this.config = config;
    this.isRunning = true;

    log.info('Starting monitoring integration...', {
      apiUrl: config.apiUrl,
      interviewId: config.interviewId,
    });

    try {
      // Initialize API client
      this.apiClient = new ApiClient(config.apiUrl, config.token);
      log.info('API client initialized');

      // Initialize Socket client
      this.socketClient = new SocketClient(config.apiUrl, config.token);
      this.socketClient.setMainWindow(config.mainWindow);
      this.socketClient.setInterviewId(config.interviewId);
      this.socketClient.connect();
      log.info('Socket client initialized and connected');

      // Setup termination handler
      this.socketClient.onTermination((reason) => {
        log.error('Interview terminated by server:', reason);
        config.mainWindow.webContents.send('update-status', {
          status: 'terminated',
          message: 'Interview has been terminated',
          reason,
        });
        
        // Stop monitoring after short delay
        setTimeout(() => {
          this.stop();
        }, 5000);
      });

      // Setup warning handler
      this.socketClient.onWarning((message, remaining) => {
        log.warn(`Violation warning: ${message}, Warnings remaining: ${remaining}`);
        
        config.mainWindow.webContents.send('show-critical-warning', {
          title: 'Violation Warning',
          message: `${message}\n\nYou have ${remaining} warning(s) remaining before your interview is terminated.`,
          warningsRemaining: remaining,
        });
      });

      // Initialize Process Monitor
      this.processMonitor = new ProcessMonitor({
        checkInterval: 5000,
        prohibitedProcesses: [
          'teamviewer',
          'anydesk',
          'chrome remote desktop',
          'ultraviewer',
          'ammyy',
          'logmein',
          'gotomypc',
          'vnc',
          'remotepc',
          'supremo',
          'zoho assist',
          'splashtop',
        ],
        onViolation: async (violation) => {
          await this.handleViolation(violation);
        },
      });
      this.processMonitor.start();
      log.info('Process monitor started');

      // Initialize Display Monitor
      this.displayMonitor = new DisplayMonitor({
        onDisplayChange: async (displayCount: number) => {
          if (displayCount > 1) {
            await this.handleViolation({
              type: 'MULTIPLE_DISPLAYS',
              severity: 'high',
              metadata: {
                count: displayCount,
                details: `${displayCount} displays detected. Only 1 display allowed during interview.`,
              },
            });
          }
        },
      });
      this.displayMonitor.start();
      log.info('Display monitor started');

      // Initialize Window Monitor
      this.windowMonitor = new WindowMonitor({
        targetWindowTitle: 'RecuirtPro Interview',
        onFocusLost: async () => {
          await this.handleViolation({
            type: 'WINDOW_FOCUS_LOST',
            severity: 'medium',
            metadata: {
              details: 'Interview window lost focus. Please keep the interview window in focus.',
            },
          });
        },
      });
      this.windowMonitor.start();
      log.info('Window monitor started');

      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 5000);
      log.info('Heartbeat started (5s interval)');

      // Notify renderer that monitoring started
      config.mainWindow.webContents.send('update-status', {
        status: 'monitoring',
        message: 'Monitoring active',
      });

      log.info('✅ All monitoring services started successfully');
    } catch (error) {
      log.error('Failed to start monitoring:', error);
      this.stop();
      throw error;
    }
  }

  private async handleViolation(violation: Violation) {
    log.warn('🚨 Violation detected:', {
      type: violation.type,
      severity: violation.severity,
      metadata: violation.metadata,
    });

    if (!this.config || !this.isRunning) {
      log.warn('Monitoring not configured or not running, ignoring violation');
      return;
    }

    try {
      // Report to backend via HTTP
      if (this.apiClient) {
        const response = await this.apiClient.reportViolation({
          interviewId: this.config.interviewId,
          eventType: violation.type,
          metadata: {
            severity: violation.severity,
            ...violation.metadata,
          },
        });

        log.info('✅ Violation reported to backend via HTTP');

        // Check if interview terminated
        if (response?.data?.action === 'INTERVIEW_TERMINATED') {
          log.error('⚠️  Interview terminated by backend after violation');
          
          if (this.config.mainWindow && !this.config.mainWindow.isDestroyed()) {
            this.config.mainWindow.webContents.send('update-status', {
              status: 'terminated',
              message: 'Interview terminated due to multiple violations',
              reason: response.data.data.terminationReason,
            });
          }
          
          setTimeout(() => {
            this.stop();
          }, 5000);
          return;
        }

        // Check for warnings
        if (response.data?.data?.action === 'WARNING') {
          const warningsRemaining = response.data.data.warningsRemaining;
          log.warn(`⚠️  Warning issued. ${warningsRemaining} warnings remaining`);
          
          if (this.config.mainWindow && !this.config.mainWindow.isDestroyed()) {
            this.config.mainWindow.webContents.send('show-critical-warning', {
              title: 'Critical Violation Warning',
              message: response.data.data.message,
              warningsRemaining,
            });
          }
        }
      }

      // Report via WebSocket for real-time updates to HR dashboard
      if (this.socketClient) {
        this.socketClient.reportViolation({
          type: violation.type,
          severity: violation.severity,
          metadata: violation.metadata,
          timestamp: new Date().toISOString(),
        });
        log.info('✅ Violation reported via WebSocket');
      }

      // Notify renderer process
      if (this.config.mainWindow && !this.config.mainWindow.isDestroyed()) {
        this.config.mainWindow.webContents.send('violation-detected', {
          type: violation.type,
          severity: violation.severity,
          metadata: violation.metadata,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      log.error('❌ Failed to report violation:', error.message);
    }
  }

  private async sendHeartbeat() {
    if (!this.config || !this.isRunning) {
      return;
    }

    try {
      // Send heartbeat via HTTP
      if (this.apiClient) {
        const response = await this.apiClient.heartbeat({
          interviewId: this.config.interviewId,
          status: 'active',
        });

        // Check if interview terminated
        if (response?.data?.action === 'TERMINATE') {
          log.error('⚠️  Interview terminated - detected via heartbeat');
          
          if (this.config.mainWindow && !this.config.mainWindow.isDestroyed()) {
            this.config.mainWindow.webContents.send('update-status', {
              status: 'terminated',
              message: 'Interview has been terminated',
              reason: response.data.data.reason,
            });
          }
          
          setTimeout(() => {
            this.stop();
          }, 5000);
          return;
        }

        log.debug('Heartbeat sent successfully');
      }

      // Also send via WebSocket
      if (this.socketClient) {
        this.socketClient.sendHeartbeat();
      }
    } catch (error: any) {
      log.error('Heartbeat failed:', error.message);
      
      // If heartbeat fails multiple times, might indicate connection loss
      // Could implement reconnection logic here
    }
  }

  stop() {
    if (!this.isRunning) {
      log.warn('Monitoring already stopped');
      return;
    }

    log.info('Stopping monitoring integration...');
    this.isRunning = false;

    if (this.processMonitor) {
      this.processMonitor.stop();
      this.processMonitor = null;
      log.info('Process monitor stopped');
    }

    if (this.displayMonitor) {
      this.displayMonitor.stop();
      this.displayMonitor = null;
      log.info('Display monitor stopped');
    }

    if (this.windowMonitor) {
      this.windowMonitor.stop();
      this.windowMonitor = null;
      log.info('Window monitor stopped');
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      log.info('Heartbeat stopped');
    }

    if (this.socketClient) {
      this.socketClient.disconnect();
      this.socketClient = null;
      log.info('Socket client disconnected');
    }

    this.apiClient = null;
    this.config = null;

    log.info('✅ Monitoring integration stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      processMonitorActive: this.processMonitor !== null,
      displayMonitorActive: this.displayMonitor !== null,
      windowMonitorActive: this.windowMonitor !== null,
      socketConnected: this.socketClient !== null,
      apiClientActive: this.apiClient !== null,
    };
  }
}
