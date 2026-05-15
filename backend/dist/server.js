"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const database_1 = __importDefault(require("./config/database"));
const logger_1 = __importDefault(require("./utils/logger"));
const http_1 = require("http");
const socketController_1 = require("./socket/socketController");
const queueProcessors_1 = require("./services/queueProcessors");
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(`UNCAUGHT EXCEPTION! Shutting down...`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    logger_1.default.error(`UNCAUGHT EXCEPTION! 💥 Shutting down...`);
    logger_1.default.error(`Error: ${error.message}`);
    logger_1.default.error(`Stack: ${error.stack}`);
    process.exit(1);
});
let server;
// Start server function
const startServer = async () => {
    try {
        console.log('Starting server...');
        console.log('__dirname:', __dirname);
        console.log('NODE_ENV:', config_1.default.env);
        console.log('PORT:', config_1.default.port);
        console.log('MONGODB_URI:', config_1.default.mongoUri ? config_1.default.mongoUri.substring(0, 30) + '...' : 'NOT SET');
        // Connect to database first
        await (0, database_1.default)();
        console.log('Database connected, setting up HTTP server...');
        // Create HTTP server
        const httpServer = (0, http_1.createServer)(app_1.default);
        // Initialize Socket.IO
        (0, socketController_1.initializeSocket)(httpServer);
        logger_1.default.info('Socket.IO initialized successfully');
        // Initialize Bull queue processors
        logger_1.default.info('Bull queue processors initialized (email, cross-portal)');
        // Then start the server
        server = httpServer.listen(config_1.default.port, () => {
            logger_1.default.info(`Server running in ${config_1.default.env} mode on port ${config_1.default.port}`);
            logger_1.default.info(`API Documentation available at http://localhost:${config_1.default.port}/api-docs`);
            logger_1.default.info(`WebSocket server ready for connections`);
        });
    }
    catch (error) {
        console.error(`Failed to start server: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        logger_1.default.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};
// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error(`UNHANDLED REJECTION! Shutting down...`);
    console.error(`Error: ${error?.message}`);
    console.error(`Stack: ${error?.stack}`);
    logger_1.default.error(`UNHANDLED REJECTION! 💥 Shutting down...`);
    logger_1.default.error(`Error: ${error.message}`);
    logger_1.default.error(`Stack: ${error.stack}`);
    if (server) {
        server.close(() => {
            process.exit(1);
        });
    }
    else {
        process.exit(1);
    }
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.default.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    await (0, queueProcessors_1.closeQueues)();
    if (server) {
        server.close(() => {
            logger_1.default.info('💥 Process terminated!');
        });
    }
});
// Start the server
startServer();
exports.default = app_1.default;
//# sourceMappingURL=server.js.map