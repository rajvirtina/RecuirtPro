/**
 * Convert UTC to user timezone
 */
export declare const convertToUserTimezone: (utcDate: Date, timezone: string) => string;
/**
 * Convert user timezone to UTC
 */
export declare const convertToUTC: (dateString: string, timezone: string) => Date;
/**
 * Format date for display
 */
export declare const formatDateForDisplay: (date: Date, timezone: string, formatString?: string) => string;
/**
 * Get time slots for scheduling
 */
export declare const generateTimeSlots: (startDate: Date, endDate: Date, slotDuration: number, // in minutes
timezone: string) => Array<{
    start: Date;
    end: Date;
    formatted: string;
}>;
/**
 * Check if date is in retention period
 */
export declare const isWithinRetentionPeriod: (date: Date, retentionDays: number) => boolean;
//# sourceMappingURL=date.d.ts.map