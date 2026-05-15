"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinRetentionPeriod = exports.generateTimeSlots = exports.formatDateForDisplay = exports.convertToUTC = exports.convertToUserTimezone = void 0;
const date_fns_tz_1 = require("date-fns-tz");
const date_fns_1 = require("date-fns");
/**
 * Convert UTC to user timezone
 */
const convertToUserTimezone = (utcDate, timezone) => {
    return (0, date_fns_tz_1.formatInTimeZone)(utcDate, timezone, 'yyyy-MM-dd HH:mm:ss zzz');
};
exports.convertToUserTimezone = convertToUserTimezone;
/**
 * Convert user timezone to UTC
 */
const convertToUTC = (dateString, timezone) => {
    const date = (0, date_fns_1.parseISO)(dateString);
    return new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
};
exports.convertToUTC = convertToUTC;
/**
 * Format date for display
 */
const formatDateForDisplay = (date, timezone, formatString = 'PPpp') => {
    return (0, date_fns_tz_1.formatInTimeZone)(date, timezone, formatString);
};
exports.formatDateForDisplay = formatDateForDisplay;
/**
 * Get time slots for scheduling
 */
const generateTimeSlots = (startDate, endDate, slotDuration, // in minutes
timezone) => {
    const slots = [];
    let currentSlot = startDate;
    while (currentSlot < endDate) {
        const slotEnd = (0, date_fns_1.addMinutes)(currentSlot, slotDuration);
        if (slotEnd <= endDate) {
            slots.push({
                start: currentSlot,
                end: slotEnd,
                formatted: `${(0, date_fns_tz_1.formatInTimeZone)(currentSlot, timezone, 'HH:mm')} - ${(0, date_fns_tz_1.formatInTimeZone)(slotEnd, timezone, 'HH:mm')}`,
            });
        }
        currentSlot = slotEnd;
    }
    return slots;
};
exports.generateTimeSlots = generateTimeSlots;
/**
 * Check if date is in retention period
 */
const isWithinRetentionPeriod = (date, retentionDays) => {
    const expiryDate = (0, date_fns_1.addDays)(date, retentionDays);
    return new Date() <= expiryDate;
};
exports.isWithinRetentionPeriod = isWithinRetentionPeriod;
//# sourceMappingURL=date.js.map