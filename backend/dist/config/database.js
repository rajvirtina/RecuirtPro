"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = __importDefault(require("./index"));
const logger_1 = __importDefault(require("../utils/logger"));
const connectDB = async () => {
    try {
        console.log('Connecting to MongoDB...');
        const conn = await mongoose_1.default.connect(index_1.default.mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        logger_1.default.info(`MongoDB Connected: ${conn.connection.host}`);
        // Connection events
        mongoose_1.default.connection.on('error', (err) => {
            console.error(`MongoDB connection error: ${err}`);
            logger_1.default.error(`MongoDB connection error: ${err}`);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
            logger_1.default.warn('MongoDB disconnected');
        });
    }
    catch (error) {
        console.error(`FATAL: Failed to connect to MongoDB: ${error.message}`);
        console.error(`Connection string starts with: ${index_1.default.mongoUri?.substring(0, 40)}...`);
        logger_1.default.error(`Error connecting to MongoDB: ${error}`);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
exports.default = exports.connectDB;
//# sourceMappingURL=database.js.map