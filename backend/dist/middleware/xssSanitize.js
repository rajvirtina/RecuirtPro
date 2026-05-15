"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.xssSanitize = void 0;
const xss_1 = __importDefault(require("xss"));
/**
 * XSS sanitization middleware (replaces deprecated xss-clean v0.1.4)
 * Recursively sanitizes all string values in req.body, req.query, and req.params.
 */
function sanitizeValue(value) {
    if (typeof value === 'string') {
        return (0, xss_1.default)(value);
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
        const sanitized = {};
        for (const key of Object.keys(value)) {
            sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
    }
    return value;
}
const xssSanitize = (req, _res, next) => {
    if (req.body)
        req.body = sanitizeValue(req.body);
    if (req.query)
        req.query = sanitizeValue(req.query);
    if (req.params)
        req.params = sanitizeValue(req.params);
    next();
};
exports.xssSanitize = xssSanitize;
//# sourceMappingURL=xssSanitize.js.map