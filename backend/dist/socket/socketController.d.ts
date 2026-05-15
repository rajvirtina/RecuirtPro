/**
 * Socket.IO Server Configuration and Event Handlers
 * Handles real-time proctoring events and HR notifications
 */
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
export declare const initializeSocket: (server: HTTPServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getSocketIO: () => Server;
/**
 * Emit violation event to HR dashboard
 */
export declare const emitViolation: (interviewId: string, violation: any) => void;
/**
 * Send termination command to desktop app
 */
export declare const emitInterviewTermination: (interviewId: string, reason: string) => void;
/**
 * Send warning to desktop app
 */
export declare const emitWarning: (interviewId: string, message: string, warningsRemaining: number) => void;
//# sourceMappingURL=socketController.d.ts.map