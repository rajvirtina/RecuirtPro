"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookSlot = exports.getScheduleByToken = exports.generateSelfScheduleLink = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Interview_1 = require("../models/Interview");
const tokenStore = new Map();
/**
 * Generate a self-schedule link for a candidate
 * POST /api/v1/schedule/generate/:interviewId
 */
const generateSelfScheduleLink = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const interview = await Interview_1.Interview.findById(interviewId)
            .populate('jobId', 'title')
            .populate('candidateId', 'firstName lastName email')
            .populate('companyId', 'name logo');
        if (!interview) {
            res.status(404).json({ success: false, message: 'Interview not found' });
            return;
        }
        // Generate secure token
        const token = crypto_1.default.randomBytes(32).toString('hex');
        // Store token mapping
        tokenStore.set(token, {
            interviewId: interview._id.toString(),
            companyId: interview.companyId?.toString() || '',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        // Also store token on interview document for persistence
        await Interview_1.Interview.findByIdAndUpdate(interviewId, {
            $set: { 'metadata.selfScheduleToken': token },
        });
        res.json({ success: true, token });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};
exports.generateSelfScheduleLink = generateSelfScheduleLink;
/**
 * Get schedule data by token (public, no auth required)
 * GET /api/v1/schedule/:token
 */
const getScheduleByToken = async (req, res) => {
    try {
        const { token } = req.params;
        // Look up token in memory store first
        let tokenData = tokenStore.get(token);
        // Fallback: search in interview metadata
        if (!tokenData) {
            const interview = await Interview_1.Interview.findOne({ 'metadata.selfScheduleToken': token });
            if (interview) {
                tokenData = {
                    interviewId: interview._id.toString(),
                    companyId: interview.companyId?.toString() || '',
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                };
                tokenStore.set(token, tokenData);
            }
        }
        if (!tokenData) {
            res.status(404).json({ success: false, message: 'Invalid or expired scheduling link' });
            return;
        }
        if (tokenData.expiresAt < new Date()) {
            tokenStore.delete(token);
            res.status(410).json({ success: false, message: 'This scheduling link has expired' });
            return;
        }
        const interview = await Interview_1.Interview.findById(tokenData.interviewId)
            .populate('jobId', 'title location')
            .populate('candidateId', 'firstName lastName email')
            .populate('companyId', 'name logo');
        if (!interview) {
            res.status(404).json({ success: false, message: 'Interview not found' });
            return;
        }
        const job = interview.jobId;
        const candidate = interview.candidateId;
        const company = interview.companyId;
        // Generate available time slots for the next 2 weeks (Mon-Fri, 9am-6pm)
        const slots = [];
        const now = new Date();
        for (let day = 1; day <= 14; day++) {
            const date = new Date(now);
            date.setDate(now.getDate() + day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6)
                continue; // skip weekends
            const dateStr = date.toISOString().split('T')[0];
            const hourSlots = [
                { start: '09:00', end: '09:30' },
                { start: '09:30', end: '10:00' },
                { start: '10:00', end: '10:30' },
                { start: '10:30', end: '11:00' },
                { start: '11:00', end: '11:30' },
                { start: '11:30', end: '12:00' },
                { start: '14:00', end: '14:30' },
                { start: '14:30', end: '15:00' },
                { start: '15:00', end: '15:30' },
                { start: '15:30', end: '16:00' },
                { start: '16:00', end: '16:30' },
                { start: '16:30', end: '17:00' },
                { start: '17:00', end: '17:30' },
                { start: '17:30', end: '18:00' },
            ];
            for (const slot of hourSlots) {
                slots.push({
                    _id: `${dateStr}-${slot.start}`,
                    date: dateStr,
                    startTime: slot.start,
                    endTime: slot.end,
                    available: true,
                });
            }
        }
        const availableFrom = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        const availableTo = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        res.json({
            success: true,
            data: {
                companyName: company?.name || 'Company',
                companyLogo: company?.logo || undefined,
                jobTitle: job?.title || 'Interview',
                interviewType: interview.round || 'Interview',
                duration: interview.duration || 60,
                candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : '',
                candidateEmail: candidate?.email || '',
                availableFrom,
                availableTo,
                availableHoursStart: '09:00',
                availableHoursEnd: '18:00',
                slots,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};
exports.getScheduleByToken = getScheduleByToken;
/**
 * Book a slot (public, no auth required)
 * POST /api/v1/schedule/:token/book
 */
const bookSlot = async (req, res) => {
    try {
        const { token } = req.params;
        const { slotId, candidateName, candidateEmail } = req.body;
        let tokenData = tokenStore.get(token);
        if (!tokenData) {
            const interview = await Interview_1.Interview.findOne({ 'metadata.selfScheduleToken': token });
            if (interview) {
                tokenData = {
                    interviewId: interview._id.toString(),
                    companyId: interview.companyId?.toString() || '',
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                };
            }
        }
        if (!tokenData) {
            res.status(404).json({ success: false, message: 'Invalid or expired scheduling link' });
            return;
        }
        if (!slotId) {
            res.status(400).json({ success: false, message: 'Slot ID is required' });
            return;
        }
        // Parse slot ID to get date and time
        const [date, startTime] = slotId.split('-');
        const scheduledTime = new Date(`${date}T${startTime}:00`);
        if (isNaN(scheduledTime.getTime())) {
            res.status(400).json({ success: false, message: 'Invalid slot selection' });
            return;
        }
        // Update the interview with the candidate-selected time
        await Interview_1.Interview.findByIdAndUpdate(tokenData.interviewId, {
            scheduledTime,
            status: 'confirmed',
            candidateConfirmed: true,
            candidateConfirmedAt: new Date(),
        });
        // Invalidate token after use
        tokenStore.delete(token);
        res.json({
            success: true,
            message: 'Interview scheduled successfully!',
            data: { scheduledTime: scheduledTime.toISOString() },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};
exports.bookSlot = bookSlot;
//# sourceMappingURL=scheduleController.js.map