/**
 * Display Monitor
 * Monitors connected displays/monitors
 */

import { screen } from 'electron';
import log from 'electron-log';

export interface DisplayMonitorConfig {
  onDisplayChange: (displayCount: number) => void;
}

export class DisplayMonitor {
  private config: DisplayMonitorConfig;
  private currentDisplayCount: number = 0;

  constructor(config: DisplayMonitorConfig) {
    this.config = config;
    this.currentDisplayCount = screen.getAllDisplays().length;
  }

  start() {
    log.info('DisplayMonitor: Starting...');
    
    // Listen for display changes
    screen.on('display-added', () => {
      this.handleDisplayChange();
    });

    screen.on('display-removed', () => {
      this.handleDisplayChange();
    });

    // Initial check
    this.handleDisplayChange();
  }

  stop() {
    log.info('DisplayMonitor: Stopping...');
    screen.removeAllListeners('display-added');
    screen.removeAllListeners('display-removed');
  }

  private handleDisplayChange() {
    const displays = screen.getAllDisplays();
    const newCount = displays.length;

    if (newCount !== this.currentDisplayCount) {
      log.info(`DisplayMonitor: Display count changed from ${this.currentDisplayCount} to ${newCount}`);
      this.currentDisplayCount = newCount;
      this.config.onDisplayChange(newCount);
    }
  }

  getDisplayCount(): number {
    return this.currentDisplayCount;
  }

  getDisplayInfo() {
    return screen.getAllDisplays().map((display: Electron.Display) => ({
      id: display.id,
      bounds: display.bounds,
      size: display.size,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
    }));
  }
}
