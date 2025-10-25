import { format, formatInTimeZone } from 'date-fns-tz';
import { addDays, addHours, addMinutes, parseISO } from 'date-fns';

/**
 * Convert UTC to user timezone
 */
export const convertToUserTimezone = (
  utcDate: Date,
  timezone: string
): string => {
  return formatInTimeZone(utcDate, timezone, 'yyyy-MM-dd HH:mm:ss zzz');
};

/**
 * Convert user timezone to UTC
 */
export const convertToUTC = (
  dateString: string,
  timezone: string
): Date => {
  const date = parseISO(dateString);
  return new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
};

/**
 * Format date for display
 */
export const formatDateForDisplay = (
  date: Date,
  timezone: string,
  formatString = 'PPpp'
): string => {
  return formatInTimeZone(date, timezone, formatString);
};

/**
 * Get time slots for scheduling
 */
export const generateTimeSlots = (
  startDate: Date,
  endDate: Date,
  slotDuration: number, // in minutes
  timezone: string
): Array<{ start: Date; end: Date; formatted: string }> => {
  const slots: Array<{ start: Date; end: Date; formatted: string }> = [];
  let currentSlot = startDate;
  
  while (currentSlot < endDate) {
    const slotEnd = addMinutes(currentSlot, slotDuration);
    
    if (slotEnd <= endDate) {
      slots.push({
        start: currentSlot,
        end: slotEnd,
        formatted: `${formatInTimeZone(currentSlot, timezone, 'HH:mm')} - ${formatInTimeZone(slotEnd, timezone, 'HH:mm')}`,
      });
    }
    
    currentSlot = slotEnd;
  }
  
  return slots;
};

/**
 * Check if date is in retention period
 */
export const isWithinRetentionPeriod = (
  date: Date,
  retentionDays: number
): boolean => {
  const expiryDate = addDays(date, retentionDays);
  return new Date() <= expiryDate;
};
