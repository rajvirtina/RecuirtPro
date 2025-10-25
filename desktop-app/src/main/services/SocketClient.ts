/**
 * Socket Client
 * Handles WebSocket communication with backend for real-time updates
 */

import { io, Socket } from 'socket.io-client';
import log from 'electron-log';
import { BrowserWindow, dialog } from 'electron';

export class SocketClient {
  private socket: Socket | null = null;
  private baseURL: string;
  private token: string;
  private interviewId: string | null = null;
  private mainWindow: BrowserWindow | null = null;
  private terminationCallback: ((reason: string) => void) | null = null;
  private warningCallback: ((message: string, remaining: number) => void) | null = null;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  setInterviewId(interviewId: string) {
    this.interviewId = interviewId;
    
    // Join interview room
    if (this.socket?.connected) {
      this.socket.emit('join-interview', interviewId);
      log.info(`Joined interview room: ${interviewId}`);
    }
  }

  onTermination(callback: (reason: string) => void) {
    this.terminationCallback = callback;
  }

  onWarning(callback: (message: string, remaining: number) => void) {
    this.warningCallback = callback;
  }

  connect() {
    if (this.socket?.connected) {
      log.info('Socket already connected');
      return;
    }

    log.info('Connecting to WebSocket server...');

    this.socket = io(this.baseURL, {
      auth: {
        token: this.token,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      log.info('Socket connected:', this.socket?.id);
      
      // Rejoin interview room if we have an interviewId
      if (this.interviewId) {
        this.socket?.emit('join-interview', this.interviewId);
        log.info(`Rejoined interview room: ${this.interviewId}`);
      }
    });

    this.socket.on('disconnect', (reason) => {
      log.warn('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      log.error('Socket connection error:', error.message);
    });

    this.socket.on('error', (error) => {
      log.error('Socket error:', error);
    });

    // Listen for server commands
    this.socket.on('interview-terminated', (data) => {
      log.warn('Interview terminated by server:', data);
      this.handleInterviewTermination(data);
    });

    this.socket.on('warning', (data) => {
      log.info('Interview warning received:', data);
      this.handleInterviewWarning(data);
    });

    // Listen for HR commands
    this.socket.on('command', (data) => {
      log.info('Command received from HR:', data);
      this.handleHRCommand(data);
    });
  }

  disconnect() {
    if (this.socket) {
      log.info('Disconnecting socket...');
      
      // Leave interview room if we're in one
      if (this.interviewId) {
        this.socket.emit('leave-interview', this.interviewId);
      }
      
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      log.warn(`Cannot emit ${event}: Socket not connected`);
      return;
    }

    log.debug(`Emitting event: ${event}`);
    this.socket.emit(event, data);
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.socket) {
      log.warn(`Cannot listen to ${event}: Socket not initialized`);
      return;
    }

    this.socket.on(event, callback);
  }

  /**
   * Report violation to HR dashboard in real-time
   */
  reportViolation(violation: any) {
    if (!this.interviewId) {
      log.warn('Cannot report violation: No interview ID set');
      return;
    }

    this.emit('desktop-violation', {
      interviewId: this.interviewId,
      violation,
      timestamp: Date.now(),
    });
  }

  /**
   * Send heartbeat to server
   */
  sendHeartbeat() {
    if (!this.interviewId) {
      return;
    }

    this.emit('desktop-heartbeat', {
      interviewId: this.interviewId,
      timestamp: Date.now(),
    });
  }

  private handleInterviewTermination(data: any) {
    log.error('Interview terminated:', data.reason);
    
    // Show termination dialog
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      dialog.showMessageBox(this.mainWindow, {
        type: 'error',
        title: 'Interview Terminated',
        message: 'Your interview has been terminated',
        detail: data.reason || 'Multiple critical violations detected',
        buttons: ['OK'],
      }).then(() => {
        // Close the app after 5 seconds
        setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.close();
          }
        }, 5000);
      });
    }

    // Call termination callback
    if (this.terminationCallback) {
      this.terminationCallback(data.reason);
    }
  }

  private handleInterviewWarning(data: any) {
    log.warn('Interview warning:', data.message);
    
    // Show warning dialog
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      dialog.showMessageBox(this.mainWindow, {
        type: 'warning',
        title: 'Violation Warning',
        message: data.message || 'A violation has been detected',
        detail: `You have ${data.warningsRemaining || 0} warnings remaining before your interview is terminated.`,
        buttons: ['I Understand'],
      });
    }

    // Call warning callback
    if (this.warningCallback) {
      this.warningCallback(data.message, data.warningsRemaining);
    }
  }

  private handleHRCommand(data: any) {
    log.info('Processing HR command:', data.command);
    
    switch (data.command) {
      case 'TERMINATE':
        this.handleInterviewTermination({
          reason: data.reason || 'Terminated by HR',
        });
        break;
        
      case 'WARNING':
        this.handleInterviewWarning({
          message: data.message || 'Warning issued by HR',
        });
        break;
        
      default:
        log.warn('Unknown HR command:', data.command);
    }
  }
}
