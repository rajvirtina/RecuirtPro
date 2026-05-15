"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audit = exports.createAuditLog = void 0;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Create audit log entry
 */
const createAuditLog = async (userId, action, resource, resourceId, description, req, changes) => {
    try {
        const user = req.user;
        await models_1.AuditLog.create({
            userId,
            userEmail: user?.email,
            userName: user ? `${user.firstName} ${user.lastName}` : undefined,
            companyId: user?.companyId,
            action,
            resource,
            resourceId,
            description,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            changes,
            timestamp: new Date(),
        });
    }
    catch (error) {
        logger_1.default.error(`Failed to create audit log: ${error}`);
    }
};
exports.createAuditLog = createAuditLog;
/**
 * Audit middleware
 */
const audit = (action, resource) => {
    return async (req, res, next) => {
        const user = req.user;
        const resourceId = req.params.id;
        try {
            await (0, exports.createAuditLog)(user?._id, action, resource, resourceId, `${action} ${resource}${resourceId ? ` ${resourceId}` : ''}`, req);
        }
        catch (error) {
            logger_1.default.error(`Audit middleware error: ${error}`);
        }
        next();
    };
};
exports.audit = audit;
//# sourceMappingURL=audit.js.map