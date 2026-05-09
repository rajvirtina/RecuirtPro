import app from './app';
import config from './config';
import connectDB from './config/database';
import logger from './utils/logger';
import { createServer } from 'http';
import { initializeSocket } from './socket/socketController';
import { closeQueues } from './services/queueProcessors';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`UNCAUGHT EXCEPTION! 💥 Shutting down...`);
  logger.error(`Error: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  process.exit(1);
});

let server: any;

// Start server function
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Initialize Socket.IO
    initializeSocket(httpServer);
    logger.info('Socket.IO initialized successfully');
    
    // Initialize Bull queue processors
    logger.info('Bull queue processors initialized (email, cross-portal)');
    
    // Then start the server
    server = httpServer.listen(config.port, () => {
      logger.info(`Server running in ${config.env} mode on port ${config.port}`);
      logger.info(`API Documentation available at http://localhost:${config.port}/api-docs`);
      logger.info(`WebSocket server ready for connections`);
    });
  } catch (error: any) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: Error) => {
  logger.error(`UNHANDLED REJECTION! 💥 Shutting down...`);
  logger.error(`Error: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  await closeQueues();
  if (server) {
    server.close(() => {
      logger.info('💥 Process terminated!');
    });
  }
});

// Start the server
startServer();

export default app;

