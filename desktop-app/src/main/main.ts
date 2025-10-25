/**
 * RecuirtPro Desktop Monitor - Main Process
 * Copyright (c) 2025 SruRaj IT Solutions
 * 
 * Main Electron process responsible for:
 * - Window management
 * - System monitoring initialization
 * - IPC communication with renderer
 * - Auto-update functionality
 */

import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import Store from 'electron-store';
import { ProcessMonitor } from './monitors/ProcessMonitor';
import { DisplayMonitor } from './monitors/DisplayMonitor';
import { WindowMonitor } from './monitors/WindowMonitor';
import { ApiClient } from './services/ApiClient';
import { SocketClient } from './services/SocketClient';

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Global flag for app quitting state
let isQuitting = false;

// Initialize persistent storage
const store = new Store({
  defaults: {
    apiUrl: 'http://localhost:5001/api/v1',
    interviewId: null,
    candidateId: null,
    token: null,
    monitoringEnabled: false,
  },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let processMonitor: ProcessMonitor | null = null;
let displayMonitor: DisplayMonitor | null = null;
let windowMonitor: WindowMonitor | null = null;
let apiClient: ApiClient | null = null;
let socketClient: SocketClient | null = null;

const isDev = !app.isPackaged;
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'RecuirtPro Interview Monitor',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
    show: false,
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: false,
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window loaded and shown');
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event: any) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
    return true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: 'Monitoring Status',
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('RecuirtPro Monitor - Not Active');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

function initializeMonitoring(config: {
  apiUrl: string;
  token: string;
  interviewId: string;
  candidateId: string;
}) {
  log.info('Initializing monitoring with config:', {
    apiUrl: config.apiUrl,
    interviewId: config.interviewId,
    candidateId: config.candidateId,
  });

  // Initialize API client
  apiClient = new ApiClient(config.apiUrl, config.token);

  // Initialize Socket.IO client for real-time communication
  socketClient = new SocketClient(config.apiUrl, config.token);

  // Initialize monitors
  processMonitor = new ProcessMonitor({
    prohibitedProcesses: [
      'teamviewer.exe',
      'teamviewer',
      'anydesk.exe',
      'anydesk',
      'ultraviewer.exe',
      'ultraviewer',
      'vncviewer.exe',
      'vncviewer',
      'chrome remote desktop',
      'remotetoanywhere',
      'logmein',
    ],
    checkInterval: 5000, // 5 seconds
    onViolation: (violation: any) => {
      handleViolation(violation);
    },
  });

  displayMonitor = new DisplayMonitor({
    onDisplayChange: (displays: number) => {
      handleDisplayChange(displays);
    },
  });

  windowMonitor = new WindowMonitor({
    targetWindowTitle: 'RecuirtPro Interview',
    onFocusLost: () => {
      handleFocusLost();
    },
  });

  // Start monitoring
  processMonitor.start();
  displayMonitor.start();
  windowMonitor.start();

  // Connect socket
  socketClient.connect();

  // Update tray
  tray?.setToolTip('RecuirtPro Monitor - Active');

  log.info('Monitoring started successfully');
}

function stopMonitoring() {
  log.info('Stopping monitoring...');

  processMonitor?.stop();
  displayMonitor?.stop();
  windowMonitor?.stop();
  socketClient?.disconnect();

  processMonitor = null;
  displayMonitor = null;
  windowMonitor = null;
  socketClient = null;
  apiClient = null;

  tray?.setToolTip('RecuirtPro Monitor - Not Active');

  log.info('Monitoring stopped');
}

function handleViolation(violation: {
  type: string;
  processName?: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}) {
  log.warn('Violation detected:', violation);

  // Send to renderer for UI update
  mainWindow?.webContents.send('violation-detected', violation);

  // Send to backend via API
  if (apiClient && store.get('interviewId')) {
    apiClient.reportViolation({
      interviewId: store.get('interviewId') as string,
      eventType: violation.type,
      metadata: {
        processName: violation.processName,
        severity: violation.severity,
      },
    });
  }

  // Send via WebSocket for real-time HR notification
  if (socketClient) {
    socketClient.emit('violation', {
      interviewId: store.get('interviewId'),
      violation,
    });
  }

  // Critical violations: Show warning dialog
  if (violation.severity === 'critical') {
    mainWindow?.webContents.send('show-critical-warning', {
      title: 'Critical Violation Detected',
      message: `Prohibited application detected: ${violation.processName}.\nPlease close it immediately or your interview will be terminated.`,
    });
  }
}

function handleDisplayChange(displays: number) {
  log.info(`Display count changed: ${displays} display(s)`);

  if (displays > 1) {
    handleViolation({
      type: 'MULTIPLE_DISPLAYS',
      timestamp: Date.now(),
      severity: 'high',
    });
  }
}

function handleFocusLost() {
  log.info('Interview window focus lost');

  handleViolation({
    type: 'WINDOW_FOCUS_LOST',
    timestamp: Date.now(),
    severity: 'medium',
  });
}

// IPC Handlers
ipcMain.handle('start-monitoring', async (_event: any, config: any) => {
  try {
    // Save config to store
    store.set('apiUrl', config.apiUrl);
    store.set('token', config.token);
    store.set('interviewId', config.interviewId);
    store.set('candidateId', config.candidateId);
    store.set('monitoringEnabled', true);

    initializeMonitoring(config);

    return { success: true };
  } catch (error: any) {
    log.error('Error starting monitoring:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-monitoring', async () => {
  try {
    stopMonitoring();
    store.set('monitoringEnabled', false);

    return { success: true };
  } catch (error: any) {
    log.error('Error stopping monitoring:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-config', async () => {
  return {
    apiUrl: store.get('apiUrl'),
    interviewId: store.get('interviewId'),
    candidateId: store.get('candidateId'),
    monitoringEnabled: store.get('monitoringEnabled'),
  };
});

ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
  };
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for updates...');
  mainWindow?.webContents.send('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', (info: any) => {
  log.info('Update available:', info);
  mainWindow?.webContents.send('update-status', { status: 'available', info });
});

autoUpdater.on('update-not-available', (info: any) => {
  log.info('Update not available:', info);
  mainWindow?.webContents.send('update-status', { status: 'not-available' });
});

autoUpdater.on('error', (err: any) => {
  log.error('Update error:', err);
  mainWindow?.webContents.send('update-status', { status: 'error', error: err.message });
});

autoUpdater.on('download-progress', (progressObj: any) => {
  log.info('Download progress:', progressObj.percent);
  mainWindow?.webContents.send('update-status', { status: 'downloading', progress: progressObj.percent });
});

autoUpdater.on('update-downloaded', (info: any) => {
  log.info('Update downloaded:', info);
  mainWindow?.webContents.send('update-status', { status: 'downloaded', info });
});

// App lifecycle events
app.on('ready', () => {
  createWindow();
  createTray();

  // Check for updates in production
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000);
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when windows are closed
  if (!isMac) {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopMonitoring();
});
