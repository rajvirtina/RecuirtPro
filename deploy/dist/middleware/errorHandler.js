"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFound = exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    // Log error
    logger_1.default.error(`Error: ${err.message}`, {
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        return (0, response_1.sendError)(res, message, 404);
    }
    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        return (0, response_1.sendError)(res, message, 400);
    }
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((val) => val.message);
        return (0, response_1.sendError)(res, 'Validation error', 400, messages);
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return (0, response_1.sendError)(res, 'Invalid token', 401);
    }
    if (err.name === 'TokenExpiredError') {
        return (0, response_1.sendError)(res, 'Token expired', 401);
    }
    return (0, response_1.sendError)(res, error.message || 'Server Error', error.statusCode || 500);
};
exports.errorHandler = errorHandler;
/**
 * Not found middleware
 */
const notFound = (req, res, next) => {
    return (0, response_1.sendError)(res, `Route ${req.originalUrl} not found`, 404);
};
exports.notFound = notFound;
/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map