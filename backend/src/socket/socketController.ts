/**
 * Socket.IO Server Configuration and Event Handlers
 * Handles real-time proctoring events and HR notifications
 */

import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { config } from '../config';
import { Interview } from '../models';

let io: Server;

export const initializeSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role;
      socket.data.companyId = decoded.companyId;
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.data.userId})`);

    // ============ VIDEO CONFERENCING EVENTS ============
    
    // Join video meeting room — with authorization (SEC-13/B-18)
    socket.on('join-meeting', async ({ interviewId, userName, userRole }) => {
      try {
        const interview = await Interview.findById(interviewId);
        if (!interview) {
          socket.emit('error', { message: 'Interview not found' });
          return;
        }

        const userId = socket.data.userId;
        const role = socket.data.role;
        const userCompanyId = socket.data.companyId;

        const isCandidate = interview.candidateId?.toString() === userId;
        const isPanelMember = (interview.panel as any[]).some(
          (member: any) => (member.userId?.toString?.() || member.userId) === userId
        );
        const isAdmin = role === 'admin';
        let isCompanyMember = false;
        if ((role === 'employer' || role === 'hr') && userCompanyId && interview.companyId) {
          isCompanyMember = interview.companyId.toString() === userCompanyId.toString();
        }

        if (!isCandidate && !isPanelMember && !isAdmin && !isCompanyMember) {
          logger.warn(`Socket ${socket.id} unauthorized join-meeting attempt for ${interviewId}`);
          socket.emit('error', { message: 'Not authorized to join this meeting' });
          return;
        }

        socket.join(`meeting-${interviewId}`);
      logger.info(`User ${userName} (${userRole}) joined meeting room: ${interviewId}`);
      
      // Store participant info in socket data
      socket.data.userName = userName;
      socket.data.userRole = userRole;
      socket.data.interviewId = interviewId;
      
      // Get list of existing participants BEFORE notifying others
      const room = io.sockets.adapter.rooms.get(`meeting-${interviewId}`);
      const allSocketIds = room ? Array.from(room) : [];
      
      // Build participant info for existing users (exclude self)
      const existingParticipants: any[] = [];
      allSocketIds.forEach((socketId) => {
        if (socketId !== socket.id) {
          const participantSocket = io.sockets.sockets.get(socketId);
          if (participantSocket) {
            existingParticipants.push({
              socketId,
              userId: participantSocket.data.userId,
              userName: participantSocket.data.userName,
              userRole: participantSocket.data.userRole,
            });
          }
        }
      });
      
      // Send existing participants with full info to the new joiner
      socket.emit('existing-participants', { participants: existingParticipants });
      
      // Notify OTHER participants that someone joined (not the joiner themselves)
      socket.to(`meeting-${interviewId}`).emit('user-joined', {
        userId: socket.data.userId,
        socketId: socket.id,
        userName,
        userRole,
        timestamp: Date.now(),
      });
      } catch (error) {
        logger.error(`Error in join-meeting for ${interviewId}:`, error);
        socket.emit('error', { message: 'Failed to join meeting room' });
      }
    });

    // WebRTC Signaling - Offer
    socket.on('webrtc-offer', ({ to, offer, from }) => {
      logger.debug(`WebRTC offer from ${from} to ${to}`);
      io.to(to).emit('webrtc-offer', { from, offer });
    });

    // WebRTC Signaling - Answer
    socket.on('webrtc-answer', ({ to, answer, from }) => {
      logger.debug(`WebRTC answer from ${from} to ${to}`);
      io.to(to).emit('webrtc-answer', { from, answer });
    });

    // WebRTC Signaling - ICE Candidate
    socket.on('ice-candidate', ({ to, candidate, from }) => {
      logger.debug(`ICE candidate from ${from} to ${to}`);
      io.to(to).emit('ice-candidate', { from, candidate });
    });

    // Toggle camera
    socket.on('toggle-camera', ({ interviewId, enabled }) => {
      socket.to(`meeting-${interviewId}`).emit('participant-camera-toggle', {
        userId: socket.data.userId,
        socketId: socket.id,
        cameraEnabled: enabled,
      });
    });

    // Toggle microphone
    socket.on('toggle-microphone', ({ interviewId, enabled }) => {
      socket.to(`meeting-${interviewId}`).emit('participant-mic-toggle', {
        userId: socket.data.userId,
        socketId: socket.id,
        micEnabled: enabled,
      });
    });

    // Screen sharing
    socket.on('screen-share-started', ({ interviewId }) => {
      socket.to(`meeting-${interviewId}`).emit('participant-screen-share', {
        userId: socket.data.userId,
        socketId: socket.id,
        sharing: true,
      });
    });

    socket.on('screen-share-stopped', ({ interviewId }) => {
      socket.to(`meeting-${interviewId}`).emit('participant-screen-share', {
        userId: socket.data.userId,
        socketId: socket.id,
        sharing: false,
      });
    });

    // Chat messages
    socket.on('chat-message', ({ interviewId, message, userName }) => {
      io.to(`meeting-${interviewId}`).emit('chat-message', {
        userId: socket.data.userId,
        userName,
        message,
        timestamp: Date.now(),
      });
      logger.debug(`Chat message in meeting ${interviewId} from ${userName}`);
    });

    // Recording control
    socket.on('start-recording', ({ interviewId }) => {
      io.to(`meeting-${interviewId}`).emit('recording-started', {
        timestamp: Date.now(),
      });
      logger.info(`Recording started for meeting ${interviewId}`);
    });

    socket.on('stop-recording', ({ interviewId }) => {
      io.to(`meeting-${interviewId}`).emit('recording-stopped', {
        timestamp: Date.now(),
      });
      logger.info(`Recording stopped for meeting ${interviewId}`);
    });

    // Leave meeting
    socket.on('leave-meeting', ({ interviewId, userName }) => {
      socket.leave(`meeting-${interviewId}`);
      socket.to(`meeting-${interviewId}`).emit('user-left', {
        userId: socket.data.userId,
        socketId: socket.id,
        userName,
        timestamp: Date.now(),
      });
      logger.info(`User ${userName} left meeting room: ${interviewId}`);
    });

    // ============ PROCTORING EVENTS ============

    // Join interview-specific rooms (for HR monitoring) — room-level auth (SEC-13/B-18)
    socket.on('join-interview', async (interviewId: string) => {
      try {
        const interview = await Interview.findById(interviewId);
        if (!interview) {
          socket.emit('error', { message: 'Interview not found' });
          return;
        }

        const userId = socket.data.userId;
        const role = socket.data.role;
        const userCompanyId = socket.data.companyId;

        const isCandidate = interview.candidateId?.toString() === userId;
        const isPanelMember = (interview.panel as any[]).some(
          (member: any) => (member.userId?.toString?.() || member.userId) === userId
        );
        const isAdmin = role === 'admin';
        let isCompanyMember = false;
        if ((role === 'employer' || role === 'hr') && userCompanyId && interview.companyId) {
          isCompanyMember = interview.companyId.toString() === userCompanyId.toString();
        }

        if (!isCandidate && !isPanelMember && !isAdmin && !isCompanyMember) {
          logger.warn(`Socket ${socket.id} unauthorized join-interview attempt for ${interviewId}`);
          socket.emit('error', { message: 'Not authorized to join this interview room' });
          return;
        }

        socket.join(`interview-${interviewId}`);
        logger.info(`Socket ${socket.id} joined interview room: ${interviewId}`);
      } catch (error) {
        logger.error(`Error in join-interview for ${interviewId}:`, error);
        socket.emit('error', { message: 'Failed to join interview room' });
      }
    });

    // Leave interview room
    socket.on('leave-interview', (interviewId: string) => {
      socket.leave(`interview-${interviewId}`);
      logger.info(`Socket ${socket.id} left interview room: ${interviewId}`);
    });

    // Desktop app heartbeat
    socket.on('desktop-heartbeat', (data) => {
      logger.debug(`Desktop heartbeat from interview ${data.interviewId}`);
      
      // Emit to HR room for status update
      io.to(`interview-${data.interviewId}`).emit('candidate-status', {
        interviewId: data.interviewId,
        status: 'active',
        timestamp: Date.now(),
      });
    });

    // Desktop app violation report
    socket.on('desktop-violation', (data) => {
      logger.warn(`Desktop violation from interview ${data.interviewId}:`, data);
      
      // Emit to HR room for real-time alert
      io.to(`interview-${data.interviewId}`).emit('violation', data);
    });

    // HR commands to desktop app
    socket.on('hr-command', (data) => {
      logger.info(`HR command for interview ${data.interviewId}:`, data.command);
      
      // Emit to desktop app (assuming desktop joins interview room)
      io.to(`interview-${data.interviewId}`).emit('command', data);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      
      // If user was in a meeting, notify others
      if (socket.data.interviewId && socket.data.userName) {
        socket.to(`meeting-${socket.data.interviewId}`).emit('user-left', {
          userId: socket.data.userId,
          socketId: socket.id,
          userName: socket.data.userName,
          timestamp: Date.now(),
        });
        logger.info(`User ${socket.data.userName} disconnected from meeting ${socket.data.interviewId}`);
      }
    });
  });

  return io;
};

export const getSocketIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Emit violation event to HR dashboard
 */
export const emitViolation = (interviewId: string, violation: any) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit violation');
    return;
  }

  io.to(`interview-${interviewId}`).emit('violation', {
    interviewId,
    violation,
    timestamp: Date.now(),
  });

  logger.info(`Violation emitted to interview room ${interviewId}`);
};

/**
 * Send termination command to desktop app
 */
export const emitInterviewTermination = (interviewId: string, reason: string) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit termination');
    return;
  }

  io.to(`interview-${interviewId}`).emit('interview-terminated', {
    interviewId,
    reason,
    timestamp: Date.now(),
    action: 'TERMINATE',
  });

  logger.info(`Interview termination emitted to room ${interviewId}: ${reason}`);
};

/**
 * Send warning to desktop app
 */
export const emitWarning = (interviewId: string, message: string, warningsRemaining: number) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, cannot emit warning');
    return;
  }

  io.to(`interview-${interviewId}`).emit('warning', {
    interviewId,
    message,
    warningsRemaining,
    timestamp: Date.now(),
  });

  logger.info(`Warning emitted to interview room ${interviewId}: ${message}`);
};
