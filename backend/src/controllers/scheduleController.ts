import { Request, Response } from 'express';
import crypto from 'crypto';
import { Interview } from '../models/Interview';

/**
 * Generate a self-schedule link for a candidate.
 * Token is persisted ONLY in MongoDB — safe across PM2 cluster instances and server restarts.
 * POST /api/v1/schedule/generate/:interviewId
 */
export const generateSelfScheduleLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const { interviewId } = req.params;
    const interview = await Interview.findById(interviewId)
      .populate('jobId', 'title')
      .populate('candidateId', 'firstName lastName email')
      .populate('companyId', 'name logo');

    if (!interview) {
      res.status(404).json({ success: false, message: 'Interview not found' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Write token ONLY to DB — no in-memory store, cluster-safe
    await Interview.findByIdAndUpdate(interviewId, {
      $set: {
        'metadata.selfScheduleToken': token,
        'metadata.selfScheduleTokenExpiry': expiresAt,
      },
    });

    res.json({ success: true, token });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Get schedule data by token (public, no auth required)
 * GET /api/v1/schedule/:token
 */
export const getScheduleByToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    // Single DB query — works across all PM2 instances
    const interview = await Interview.findOne({
      'metadata.selfScheduleToken': token,
      'metadata.selfScheduleTokenExpiry': { $gt: new Date() },
    })
      .populate('jobId', 'title location')
      .populate('candidateId', 'firstName lastName email')
      .populate('companyId', 'name logo');

    if (!interview) {
      res.status(404).json({ success: false, message: 'Invalid or expired scheduling link' });
      return;
    }

    const job       = interview.jobId as any;
    const candidate = interview.candidateId as any;
    const company   = interview.companyId as any;

    // Generate available time slots for the next 2 weeks (Mon–Fri, 9am–6pm)
    const slots: any[] = [];
    const now = new Date();
    for (let day = 1; day <= 14; day++) {
      const date = new Date(now);
      date.setDate(now.getDate() + day);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      const dateStr = date.toISOString().split('T')[0];
      const hours: [string, string][] = [
        ['09:00', '09:30'], ['09:30', '10:00'], ['10:00', '10:30'], ['10:30', '11:00'],
        ['11:00', '11:30'], ['11:30', '12:00'], ['14:00', '14:30'], ['14:30', '15:00'],
        ['15:00', '15:30'], ['15:30', '16:00'], ['16:00', '16:30'], ['16:30', '17:00'],
        ['17:00', '17:30'], ['17:30', '18:00'],
      ];
      for (const [start, end] of hours) {
        slots.push({ _id: `${dateStr}-${start}`, date: dateStr, startTime: start, endTime: end, available: true });
      }
    }

    res.json({
      success: true,
      data: {
        companyName:         company?.name || 'Company',
        companyLogo:         company?.logo,
        jobTitle:            job?.title || 'Interview',
        interviewType:       interview.round || 'Interview',
        duration:            interview.duration || 60,
        candidateName:       candidate ? `${candidate.firstName} ${candidate.lastName}` : '',
        candidateEmail:      candidate?.email || '',
        availableFrom:       new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        availableTo:         new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        availableHoursStart: '09:00',
        availableHoursEnd:   '18:00',
        slots,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Book a slot (public, no auth required)
 * POST /api/v1/schedule/:token/book
 */
export const bookSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { slotId } = req.body;

    // Re-query DB — token must still be valid
    const interview = await Interview.findOne({
      'metadata.selfScheduleToken': token,
      'metadata.selfScheduleTokenExpiry': { $gt: new Date() },
    });

    if (!interview) {
      res.status(404).json({ success: false, message: 'Invalid or expired scheduling link' });
      return;
    }

    if (!slotId) {
      res.status(400).json({ success: false, message: 'Slot ID is required' });
      return;
    }

    // slotId format: "YYYY-MM-DD-HH:mm" — split at last dash to isolate date from time
    const lastDash = (slotId as string).lastIndexOf('-');
    const dateStr  = (slotId as string).slice(0, lastDash);  // "YYYY-MM-DD"
    const timeStr  = (slotId as string).slice(lastDash + 1); // "HH:mm"
    const scheduledTime = new Date(`${dateStr}T${timeStr}`);

    if (isNaN(scheduledTime.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid slot selection' });
      return;
    }

    // Book the slot and invalidate the token atomically
    await Interview.findByIdAndUpdate(interview._id, {
      $set: {
        scheduledTime,
        status:               'confirmed',
        candidateConfirmed:   true,
        candidateConfirmedAt: new Date(),
      },
      $unset: {
        'metadata.selfScheduleToken':       1,
        'metadata.selfScheduleTokenExpiry': 1,
      },
    });

    res.json({
      success: true,
      message: 'Interview scheduled successfully!',
      data: { scheduledTime: scheduledTime.toISOString() },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
