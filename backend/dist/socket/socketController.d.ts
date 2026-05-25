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
 * Push a real-time notification event to a specific user's browser tab(s).
 * The frontend listens on 'new-notification' and invalidates its query cache.
 */
export declare const emitNotificationToUser: (userId: string, payload: {
    _id?: string;
    title: string;
    message: string;
    priority?: string;
    data?: any;
}) => void;
/**
 * Send warning to desktop app
 */
export declare const emitWarning: (interviewId: string, message: string, warningsRemaining: number) => void;
//# sourceMappingURL=socketController.d.ts.map