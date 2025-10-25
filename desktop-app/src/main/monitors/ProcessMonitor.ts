/**
 * Process Monitor
 * Monitors running processes for prohibited applications
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';

const execAsync = promisify(exec);

export interface ProcessMonitorConfig {
  prohibitedProcesses: string[];
  checkInterval: number;
  onViolation: (violation: ProcessViolation) => void;
}

export interface ProcessViolation {
  type: 'PROHIBITED_PROCESS_DETECTED' | 'MULTIPLE_CHROME_INSTANCES' | 'EXCESSIVE_CPU_USAGE' | 'MEMORY_THRESHOLD_EXCEEDED';
  processName?: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    count?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    details?: string;
  };
}

export class ProcessMonitor {
  private config: ProcessMonitorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isWindows: boolean;
  private isMac: boolean;
  private maxChromeInstances: number = 1;
  private cpuThreshold: number = 80; // Percentage
  private memoryThreshold: number = 90; // Percentage

  constructor(config: ProcessMonitorConfig) {
    this.config = config;
    this.isWindows = process.platform === 'win32';
    this.isMac = process.platform === 'darwin';
  }

  start() {
    log.info('ProcessMonitor: Starting...');
    this.intervalId = setInterval(() => {
      this.checkProcesses();
    }, this.config.checkInterval);
    
    // Run immediate check
    this.checkProcesses();
  }

  stop() {
    log.info('ProcessMonitor: Stopping...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkProcesses() {
    try {
      const runningProcesses = await this.getRunningProcesses();
      
      // Check for prohibited processes
      const prohibitedFound = this.findProhibitedProcesses(runningProcesses);
      if (prohibitedFound.length > 0) {
        prohibitedFound.forEach((processName) => {
          log.warn(`ProcessMonitor: Prohibited process detected - ${processName}`);
          this.config.onViolation({
            type: 'PROHIBITED_PROCESS_DETECTED',
            processName,
            timestamp: Date.now(),
            severity: 'critical',
          });
        });
      }

      // Check for multiple Chrome instances
      await this.checkMultipleChromeInstances(runningProcesses);

      // Check system resources
      await this.checkSystemResources();
    } catch (error) {
      log.error('ProcessMonitor: Error checking processes:', error);
    }
  }

  private async checkMultipleChromeInstances(runningProcesses: string[]) {
    try {
      // Count Chrome/Edge browser processes (excluding helper processes)
      const chromeProcesses = runningProcesses.filter((process) => {
        const lower = process.toLowerCase();
        return (
          (lower.includes('chrome.exe') || lower.includes('msedge.exe') || lower.includes('google chrome')) &&
          !lower.includes('helper') &&
          !lower.includes('crashpad') &&
          !lower.includes('gpu-process') &&
          !lower.includes('utility')
        );
      });

      const chromeCount = chromeProcesses.length;

      if (chromeCount > this.maxChromeInstances) {
        log.warn(`ProcessMonitor: Multiple Chrome instances detected - ${chromeCount} instances`);
        this.config.onViolation({
          type: 'MULTIPLE_CHROME_INSTANCES',
          timestamp: Date.now(),
          severity: 'high',
          metadata: {
            count: chromeCount,
            details: `${chromeCount} browser instances detected. Only 1 allowed.`,
          },
        });
      }
    } catch (error) {
      log.error('ProcessMonitor: Error checking Chrome instances:', error);
    }
  }

  private async checkSystemResources() {
    try {
      if (this.isWindows) {
        // Windows: Use WMIC for CPU and memory
        const { stdout: cpuOutput } = await execAsync('wmic cpu get loadpercentage');
        const cpuLines = cpuOutput.split('\n').filter((line) => line.trim() && !line.includes('LoadPercentage'));
        const cpuUsage = cpuLines.length > 0 ? parseInt(cpuLines[0].trim(), 10) : 0;

        const { stdout: memOutput } = await execAsync('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value');
        const freeMatch = memOutput.match(/FreePhysicalMemory=(\d+)/);
        const totalMatch = memOutput.match(/TotalVisibleMemorySize=(\d+)/);
        
        if (freeMatch && totalMatch) {
          const freeMemory = parseInt(freeMatch[1], 10);
          const totalMemory = parseInt(totalMatch[1], 10);
          const usedMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;

          if (cpuUsage > this.cpuThreshold) {
            log.warn(`ProcessMonitor: High CPU usage detected - ${cpuUsage}%`);
            this.config.onViolation({
              type: 'EXCESSIVE_CPU_USAGE',
              timestamp: Date.now(),
              severity: 'medium',
              metadata: {
                cpuUsage,
                details: `CPU usage at ${cpuUsage}%. May affect interview performance.`,
              },
            });
          }

          if (usedMemoryPercent > this.memoryThreshold) {
            log.warn(`ProcessMonitor: High memory usage detected - ${usedMemoryPercent.toFixed(1)}%`);
            this.config.onViolation({
              type: 'MEMORY_THRESHOLD_EXCEEDED',
              timestamp: Date.now(),
              severity: 'medium',
              metadata: {
                memoryUsage: parseFloat(usedMemoryPercent.toFixed(1)),
                details: `Memory usage at ${usedMemoryPercent.toFixed(1)}%. Close unnecessary applications.`,
              },
            });
          }
        }
      } else if (this.isMac) {
        // macOS: Use top for CPU
        const { stdout: cpuOutput } = await execAsync("top -l 1 | grep 'CPU usage'");
        const cpuMatch = cpuOutput.match(/(\d+\.\d+)%\s+idle/);
        const cpuUsage = cpuMatch ? 100 - parseFloat(cpuMatch[1]) : 0;

        // macOS: Use vm_stat for memory
        const { stdout: memOutput } = await execAsync('vm_stat');
        const pageSize = 4096; // Default page size
        const freeMatch = memOutput.match(/Pages free:\s+(\d+)/);
        const activeMatch = memOutput.match(/Pages active:\s+(\d+)/);
        const inactiveMatch = memOutput.match(/Pages inactive:\s+(\d+)/);
        const wiredMatch = memOutput.match(/Pages wired down:\s+(\d+)/);
        
        if (freeMatch && activeMatch && wiredMatch) {
          const freePages = parseInt(freeMatch[1], 10);
          const activePages = parseInt(activeMatch[1], 10);
          const inactivePages = inactiveMatch ? parseInt(inactiveMatch[1], 10) : 0;
          const wiredPages = parseInt(wiredMatch[1], 10);
          
          const totalPages = freePages + activePages + inactivePages + wiredPages;
          const usedMemoryPercent = ((activePages + wiredPages) / totalPages) * 100;

          if (cpuUsage > this.cpuThreshold) {
            this.config.onViolation({
              type: 'EXCESSIVE_CPU_USAGE',
              timestamp: Date.now(),
              severity: 'medium',
              metadata: {
                cpuUsage: parseFloat(cpuUsage.toFixed(1)),
                details: `CPU usage at ${cpuUsage.toFixed(1)}%. May affect interview performance.`,
              },
            });
          }

          if (usedMemoryPercent > this.memoryThreshold) {
            this.config.onViolation({
              type: 'MEMORY_THRESHOLD_EXCEEDED',
              timestamp: Date.now(),
              severity: 'medium',
              metadata: {
                memoryUsage: parseFloat(usedMemoryPercent.toFixed(1)),
                details: `Memory usage at ${usedMemoryPercent.toFixed(1)}%. Close unnecessary applications.`,
              },
            });
          }
        }
      }
    } catch (error) {
      log.error('ProcessMonitor: Error checking system resources:', error);
    }
  }

  private async getRunningProcesses(): Promise<string[]> {
    try {
      if (this.isWindows) {
        // Windows: Use tasklist command
        const { stdout } = await execAsync('tasklist /FO CSV /NH');
        const processes = stdout
          .split('\n')
          .map((line) => {
            const match = line.match(/"([^"]+)"/);
            return match ? match[1].toLowerCase() : '';
          })
          .filter(Boolean);
        return processes;
      } else if (this.isMac) {
        // macOS: Use ps command
        const { stdout } = await execAsync('ps -A -o comm=');
        const processes = stdout
          .split('\n')
          .map((line) => line.trim().toLowerCase())
          .filter(Boolean);
        return processes;
      }
      return [];
    } catch (error) {
      log.error('ProcessMonitor: Error getting running processes:', error);
      return [];
    }
  }

  private findProhibitedProcesses(runningProcesses: string[]): string[] {
    const found: string[] = [];

    this.config.prohibitedProcesses.forEach((prohibited) => {
      const prohibitedLower = prohibited.toLowerCase();
      const match = runningProcesses.find((process) =>
        process.includes(prohibitedLower)
      );
      if (match) {
        found.push(match);
      }
    });

    return found;
  }
}
