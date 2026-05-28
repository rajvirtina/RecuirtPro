/**
 * Window Monitor — detects when the candidate switches focus away from the interview.
 * Uses platform-native commands (PowerShell on Windows, osascript on macOS, xdotool on Linux).
 * No additional npm dependency required.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';

const execAsync = promisify(exec);

export interface WindowMonitorConfig {
  targetWindowTitle: string;
  onFocusLost: () => void;
}

export class WindowMonitor {
  private config: WindowMonitorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 2000;

  constructor(config: WindowMonitorConfig) {
    this.config = config;
  }

  start() {
    log.info('WindowMonitor: Starting active-window monitoring');
    this.intervalId = setInterval(() => void this.checkActiveWindow(), this.CHECK_INTERVAL_MS);
  }

  stop() {
    log.info('WindowMonitor: Stopping');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkActiveWindow(): Promise<void> {
    try {
      const platform = process.platform;
      let activeTitle = '';

      if (platform === 'win32') {
        // PowerShell: get the MainWindowTitle of the foreground process
        const { stdout } = await execAsync(
          `powershell -NoProfile -NonInteractive -Command "` +
          `(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | ` +
          `Sort-Object CPU -Descending | Select-Object -First 1).MainWindowTitle"`,
          { timeout: 1500 }
        );
        activeTitle = stdout.trim().toLowerCase();
      } else if (platform === 'darwin') {
        // macOS: get the frontmost application name via osascript
        const { stdout } = await execAsync(
          `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
          { timeout: 1500 }
        );
        activeTitle = stdout.trim().toLowerCase();
      } else {
        // Linux: use xdotool (requires xdotool package)
        const { stdout } = await execAsync('xdotool getwindowfocus getwindowname', { timeout: 1500 });
        activeTitle = stdout.trim().toLowerCase();
      }

      if (!activeTitle) return;

      const target = this.config.targetWindowTitle.toLowerCase();
      const isInterviewWindow =
        activeTitle.includes('recruitpro') ||
        activeTitle.includes('interview') ||
        activeTitle.includes('electron') ||
        (target.length > 0 && activeTitle.includes(target));

      if (!isInterviewWindow) {
        log.warn(`WindowMonitor: Focus lost — active window: "${activeTitle}"`);
        this.config.onFocusLost();
      }
    } catch (err: any) {
      // Silently ignore transient failures (timeout, tool not installed, etc.)
      log.debug('WindowMonitor: check error (non-fatal):', err.message);
    }
  }
}
