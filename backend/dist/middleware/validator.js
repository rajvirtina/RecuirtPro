"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const express_validator_1 = require("express-validator");
const response_1 = require("../utils/response");
/**
 * Validate request using express-validator
 */
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err) => ({
            field: err.type === 'field' ? err.path : 'unknown',
            message: err.msg,
        }));
        return (0, response_1.sendError)(res, 'Validation failed', 400, errorMessages);
    }
    next();
};
exports.validate = validate;
//# sourceMappingURL=validator.js.map