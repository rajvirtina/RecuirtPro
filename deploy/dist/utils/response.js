"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPaginatedResponse = exports.sendError = exports.sendSuccess = exports.clampPagination = void 0;
/**
 * Clamp pagination params to safe bounds (B-14)
 */
const clampPagination = (page, limit) => {
    let pageNum = parseInt(page, 10);
    let limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1)
        pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1)
        limitNum = 10;
    if (limitNum > 100)
        limitNum = 100;
    return { pageNum, limitNum };
};
exports.clampPagination = clampPagination;
/**
 * Send success response
 */
const sendSuccess = (res, data, message, statusCode = 200) => {
    const response = {
        success: true,
        message,
        data,
    };
    return res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
/**
 * Send error response
 */
const sendError = (res, message, statusCode = 500, errors) => {
    const response = {
        success: false,
        message,
        errors,
    };
    return res.status(statusCode).json(response);
};
exports.sendError = sendError;
/**
 * Send paginated response
 */
const sendPaginatedResponse = (res, data, page, limit, total, message) => {
    const response = {
        success: true,
        message,
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
    return res.status(200).json(response);
};
exports.sendPaginatedResponse = sendPaginatedResponse;
//# sourceMappingURL=response.js.map