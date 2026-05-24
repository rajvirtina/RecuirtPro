import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, addBusinessDays, isWeekend } from 'date-fns';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import apiClient from '../../services/api';
import { toast } from 'sonner';
import 'react-day-picker/dist/style.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Interviewer {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  department?: string;
}

interface ScheduleInterviewModalProps {
  application: {
    _id: string;
    job: { _id: string; title: string };
    candidate?: { _id?: string; firstName: string; lastName: string; email: string };
  };
  onClose: () => void;
  onScheduled: () => void;
}

type InterviewType = 'phone_screen' | 'technical' | 'behavioral' | 'ai_interview' | 'panel';
type Platform = 'teams' | 'google_meet' | 'zoom' | 'in_person';
type ScheduleMode = 'specific' | 'candidate_choice';
type ProctoringLevel = 'none' | 'basic' | 'enhanced';

const PROCTORING_LEVELS: { value: ProctoringLevel; label: string; description: string; icon: string }[] = [
  {
    value: 'none',
    label: 'None',
    description: 'No monitoring — standard interview',
    icon: '🔓',
  },
  {
    value: 'basic',
    label: 'Basic',
    description: 'Face detection & tab-switch alerts (browser)',
    icon: '👁',
  },
  {
    value: 'enhanced',
    label: 'Enhanced',
    description: 'Full-screen lock, screen recording, desktop app required',
    icon: '🛡',
  },
];

const INTERVIEW_TYPES: { value: InterviewType; label: string }[] = [
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'technical', label: 'Technical' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'ai_interview', label: 'AI Interview' },
  { value: 'panel', label: 'Panel' },
];

const DURATIONS = [30, 45, 60, 90];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'in_person', label: 'In-Person' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleInterviewModal({ application, onClose, onScheduled }: ScheduleInterviewModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [interviewType, setInterviewType] = useState<InterviewType>('technical');
  const [duration, setDuration] = useState(60);
  const [selectedInterviewers, setSelectedInterviewers] = useState<Interviewer[]>([]);
  const [availableInterviewers, setAvailableInterviewers] = useState<Interviewer[]>([]);
  const [platform, setPlatform] = useState<Platform>('google_meet');
  const [notes, setNotes] = useState('');
  const [proctoringLevel, setProctoringLevel] = useState<ProctoringLevel>('basic');

  // Step 2 state
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('specific');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [availableFrom, setAvailableFrom] = useState<Date>(new Date());
  const [availableTo, setAvailableTo] = useState<Date>(addBusinessDays(new Date(), 5));
  const [availableHoursStart, setAvailableHoursStart] = useState('09:00');
  const [availableHoursEnd, setAvailableHoursEnd] = useState('17:00');

  // Step 3 state
  const [emailMessage, setEmailMessage] = useState('');

  // Fetch interviewers
  useEffect(() => {
    const fetchInterviewers = async () => {
      try {
        const res = await apiClient.get('/users?role=interviewer');
        setAvailableInterviewers((res.data as any) || []);
      } catch {
        // Fallback: try fetching company users
        try {
          const res = await apiClient.get('/users');
          const interviewers = ((res.data as any) || []).filter(
            (u: any) => u.role === 'interviewer' || u.role === 'hr' || u.role === 'admin'
          );
          setAvailableInterviewers(interviewers);
        } catch {
          toast.error('Failed to load interviewers');
        }
      }
    };
    fetchInterviewers();
  }, []);

  // Pre-fill email template when reaching step 3
  useEffect(() => {
    if (step === 3) {
      const candidateName = application.candidate
        ? `${application.candidate.firstName} ${application.candidate.lastName}`
        : 'Candidate';
      const jobTitle = application.job.title;
      const dateStr = scheduleMode === 'specific' && selectedDate
        ? format(selectedDate, 'EEEE, MMMM d, yyyy') + ' at ' + selectedTime
        : 'a time of your choosing';

      const enhancedNote = proctoringLevel === 'enhanced'
        ? '\n\nIMPORTANT — Proctored Interview:\nThis interview requires our secure desktop app. Please download and install it before your interview:\n  👉 https://app.recruitpro.io/download/proctor\n\nThe app monitors your screen and ensures interview integrity. It will launch automatically when you open the interview link.\n'
        : '';

      setEmailMessage(
        `Hi ${candidateName},\n\nWe'd like to invite you for a ${interviewType.replace('_', ' ')} interview for the ${jobTitle} position${scheduleMode === 'specific' ? ` on ${dateStr}` : ''}.\n\n${scheduleMode === 'candidate_choice' ? 'Please use the link below to select a time that works best for you.\n\n' : ''}${enhancedNote}We look forward to speaking with you!\n\nBest regards`
      );
    }
  }, [step, application, interviewType, scheduleMode, selectedDate, selectedTime, proctoringLevel]);

  const toggleInterviewer = (interviewer: Interviewer) => {
    setSelectedInterviewers((prev) =>
      prev.some((i) => i._id === interviewer._id)
        ? prev.filter((i) => i._id !== interviewer._id)
        : [...prev, interviewer]
    );
  };

  const canProceedStep1 = interviewType && duration && platform;
  const canProceedStep2 =
    scheduleMode === 'specific' ? selectedDate && selectedTime : availableFrom && availableTo;

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const payload: any = {
        applicationId: application._id,
        interviewType,
        duration,
        interviewerIds: selectedInterviewers.map((i) => i._id),
        platform,
        notes,
        isAI: interviewType === 'ai_interview',
        proctoringLevel,
        proctoringEnabled: proctoringLevel !== 'none',
      };

      if (scheduleMode === 'specific' && selectedDate) {
        payload.scheduledAt = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}`).toISOString();
      } else {
        payload.selfSchedule = {
          availableFrom: availableFrom.toISOString(),
          availableTo: availableTo.toISOString(),
          availableHoursStart,
          availableHoursEnd,
        };
      }

      payload.emailMessage = emailMessage;

      const res = await apiClient.post('/interviews', payload);
      const interviewId = (res.data as any)?._id;

      // Send notifications
      if (interviewId) {
        await apiClient.post(`/interviews/${interviewId}/notify`);
      }

      toast.success('Interview scheduled & notifications sent!');
      onScheduled();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-h3">Schedule Interview</h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                {application.candidate?.firstName} {application.candidate?.lastName} &middot; {application.job.title}
              </p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1 rounded">✕</button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === s ? 'bg-primary-600 text-white' :
                  step > s ? 'bg-primary-100 text-primary-700' :
                  'bg-neutral-100 text-neutral-400'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary-400' : 'bg-neutral-200'}`} />}
              </div>
            ))}
            <span className="text-xs text-neutral-500 ml-2">
              {step === 1 ? 'Setup' : step === 2 ? 'Schedule' : 'Confirm'}
            </span>
          </div>

          {/* Step 1: Interview Setup */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Interview Type */}
              <div>
                <label className="field-label">Interview Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INTERVIEW_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setInterviewType(t.value)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        interviewType === t.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                          : 'border-neutral-200 hover:border-primary-300 text-neutral-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Interview callout */}
              {interviewType === 'ai_interview' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">AI-Powered Interview</p>
                    <p className="mt-0.5 text-blue-600">The candidate will be assessed by our AI interviewer with real-time proctoring.</p>
                    <a href="/questions" className="inline-block mt-1 text-blue-700 underline hover:text-blue-900 text-xs font-medium">
                      Configure AI Interview →
                    </a>
                  </div>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="field-label">Duration</label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                        duration === d
                          ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                          : 'border-neutral-200 hover:border-primary-300 text-neutral-600'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Interviewers */}
              <div>
                <label className="field-label">Interviewers</label>
                {availableInterviewers.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic">No interviewers found</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                    {availableInterviewers.map((iv) => {
                      const selected = selectedInterviewers.some((s) => s._id === iv._id);
                      return (
                        <button
                          key={iv._id}
                          type="button"
                          onClick={() => toggleInterviewer(iv)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            selected ? 'bg-primary-50' : 'hover:bg-neutral-50'
                          }`}
                        >
                          <Avatar name={`${iv.firstName} ${iv.lastName}`} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-800 truncate">
                              {iv.firstName} {iv.lastName}
                            </p>
                            {iv.department && (
                              <p className="text-xs text-neutral-500">{iv.department}</p>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selected ? 'border-primary-500 bg-primary-500' : 'border-neutral-300'
                          }`}>
                            {selected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedInterviewers.length > 0 && (
                  <p className="text-xs text-neutral-500 mt-1">{selectedInterviewers.length} selected</p>
                )}
              </div>

              {/* Platform */}
              <div>
                <label className="field-label">Meeting Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="field-input"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="field-label">Notes for Interviewers</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="field-input min-h-[80px] resize-y"
                  placeholder="Key areas to assess, candidate context, etc."
                />
              </div>

              {/* Proctoring Level */}
              <div>
                <label className="field-label">Proctoring Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {PROCTORING_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setProctoringLevel(lvl.value)}
                      className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                        proctoringLevel === lvl.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-neutral-200 hover:border-primary-300'
                      }`}
                    >
                      <span className="text-base leading-none">{lvl.icon}</span>
                      <span className={`text-sm font-semibold ${proctoringLevel === lvl.value ? 'text-primary-700' : 'text-neutral-800'}`}>
                        {lvl.label}
                      </span>
                      <span className="text-xs text-neutral-500 leading-tight">{lvl.description}</span>
                    </button>
                  ))}
                </div>
                {proctoringLevel === 'enhanced' && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    ⚠️ Enhanced proctoring requires the candidate to install the RecuirtPro desktop app before the interview. Instructions will be included in the invitation email.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                >
                  Next: Schedule
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Schedule Selection */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleMode('specific')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    scheduleMode === 'specific'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-neutral-800">Pick a specific time</p>
                  <p className="text-xs text-neutral-500 mt-0.5">You choose the exact date & time</p>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('candidate_choice')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    scheduleMode === 'candidate_choice'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-neutral-800">Let candidate choose</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Send a self-scheduling link</p>
                </button>
              </div>

              {/* Option A: Specific Time */}
              {scheduleMode === 'specific' && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={[{ before: new Date() }, (d) => isWeekend(d)]}
                      className="border border-neutral-200 rounded-lg p-3"
                    />
                  </div>
                  <div>
                    <label className="field-label">Time</label>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="field-input w-40"
                    />
                  </div>
                </div>
              )}

              {/* Option B: Candidate Self-Schedule */}
              {scheduleMode === 'candidate_choice' && (
                <div className="space-y-4 bg-neutral-50 rounded-lg p-4">
                  <p className="text-sm text-neutral-600 font-medium">Set available window for the candidate:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">From Date</label>
                      <input
                        type="date"
                        value={format(availableFrom, 'yyyy-MM-dd')}
                        onChange={(e) => setAvailableFrom(new Date(e.target.value))}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label">To Date</label>
                      <input
                        type="date"
                        value={format(availableTo, 'yyyy-MM-dd')}
                        onChange={(e) => setAvailableTo(new Date(e.target.value))}
                        min={format(availableFrom, 'yyyy-MM-dd')}
                        className="field-input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Available From</label>
                      <input
                        type="time"
                        value={availableHoursStart}
                        onChange={(e) => setAvailableHoursStart(e.target.value)}
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label">Available Until</label>
                      <input
                        type="time"
                        value={availableHoursEnd}
                        onChange={(e) => setAvailableHoursEnd(e.target.value)}
                        className="field-input"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Candidate will receive a link to choose from available time slots within this window.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                >
                  Next: Confirm
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm & Send */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-neutral-800">Interview Summary</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-neutral-500">Candidate</span>
                  <span className="text-neutral-800 font-medium">
                    {application.candidate?.firstName} {application.candidate?.lastName}
                  </span>
                  <span className="text-neutral-500">Position</span>
                  <span className="text-neutral-800 font-medium">{application.job.title}</span>
                  <span className="text-neutral-500">Type</span>
                  <span className="text-neutral-800 font-medium capitalize">
                    {interviewType.replace('_', ' ')}
                  </span>
                  <span className="text-neutral-500">Duration</span>
                  <span className="text-neutral-800 font-medium">{duration} minutes</span>
                  <span className="text-neutral-500">Platform</span>
                  <span className="text-neutral-800 font-medium">
                    {PLATFORMS.find((p) => p.value === platform)?.label}
                  </span>
                  <span className="text-neutral-500">Schedule</span>
                  <span className="text-neutral-800 font-medium">
                    {scheduleMode === 'specific' && selectedDate
                      ? `${format(selectedDate, 'MMM d, yyyy')} at ${selectedTime}`
                      : 'Candidate self-schedule'}
                  </span>
                  {selectedInterviewers.length > 0 && (
                    <>
                      <span className="text-neutral-500">Interviewers</span>
                      <span className="text-neutral-800 font-medium">
                        {selectedInterviewers.map((i) => `${i.firstName} ${i.lastName}`).join(', ')}
                      </span>
                    </>
                  )}
                  <span className="text-neutral-500">Proctoring</span>
                  <span className={`font-medium capitalize ${
                    proctoringLevel === 'enhanced' ? 'text-amber-700' :
                    proctoringLevel === 'basic' ? 'text-primary-700' :
                    'text-neutral-500'
                  }`}>
                    {PROCTORING_LEVELS.find((l) => l.value === proctoringLevel)?.icon}{' '}
                    {proctoringLevel.charAt(0).toUpperCase() + proctoringLevel.slice(1)}
                  </span>
                </div>
              </div>

              {/* Email Message */}
              <div>
                <label className="field-label">Email to Candidate (editable)</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="field-input min-h-[120px] resize-y text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  className="flex-1"
                  onClick={handleSubmit}
                >
                  Schedule & Send Notifications
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
