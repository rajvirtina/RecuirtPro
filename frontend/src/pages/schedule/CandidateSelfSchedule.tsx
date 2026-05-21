import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isWeekend, isBefore, isAfter, startOfDay } from 'date-fns';
import 'react-day-picker/dist/style.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleData {
  companyLogo?: string;
  companyName: string;
  jobTitle: string;
  interviewType: string;
  duration: number;
  candidateName: string;
  candidateEmail: string;
  availableFrom: string;
  availableTo: string;
  availableHoursStart: string;
  availableHoursEnd: string;
  slots: TimeSlot[];
}

interface TimeSlot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

type PageState = 'loading' | 'select' | 'confirming' | 'success' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CandidateSelfSchedule() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`${apiBase}/schedule/${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Invalid or expired scheduling link');
        }
        const json = await res.json();
        const scheduleData = json.data || json;
        setData(scheduleData);
        setCandidateName(scheduleData.candidateName || '');
        setCandidateEmail(scheduleData.candidateEmail || '');
        setState('select');
      } catch (e: any) {
        setError(e.message || 'Failed to load scheduling information');
        setState('error');
      }
    };
    if (token) fetchSchedule();
  }, [token, apiBase]);

  const availableFrom = data ? startOfDay(parseISO(data.availableFrom)) : new Date();
  const availableTo = data ? startOfDay(parseISO(data.availableTo)) : new Date();

  const slotsForDate = data?.slots.filter((slot) => {
    if (!selectedDate) return false;
    return slot.date === format(selectedDate, 'yyyy-MM-dd') && slot.available;
  }) || [];

  const isDayDisabled = (day: Date) => {
    if (isWeekend(day)) return true;
    if (isBefore(day, availableFrom)) return true;
    if (isAfter(day, availableTo)) return true;
    // Disable if no available slots on this day
    const dayStr = format(day, 'yyyy-MM-dd');
    const hasSlots = data?.slots.some((s) => s.date === dayStr && s.available);
    return !hasSlots;
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !candidateName.trim() || !candidateEmail.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${apiBase}/schedule/${token}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot._id,
          candidateName: candidateName.trim(),
          candidateEmail: candidateEmail.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to book slot');
      }
      setState('success');
    } catch (e: any) {
      setError(e.message);
      // Don't go to error state, just show inline
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading State ──────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Loading scheduling info...</div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-error-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Unable to Load</h2>
          <p className="text-sm text-neutral-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Success State ──────────────────────────────────────────
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Interview Scheduled!</h2>
          <p className="text-sm text-neutral-500 mt-2">
            Check your email for the meeting link and calendar invite.
          </p>
          {selectedSlot && selectedDate && (
            <div className="mt-4 bg-neutral-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-neutral-800">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-neutral-600">{selectedSlot.startTime} – {selectedSlot.endTime}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Scheduling View ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mb-6 text-center">
          {data?.companyLogo && (
            <img src={data.companyLogo} alt={data.companyName} className="h-10 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-xl font-bold text-neutral-900">{data?.companyName}</h1>
          <p className="text-sm text-neutral-500 mt-1">{data?.jobTitle}</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-primary-50 text-primary-700 rounded-full px-3 py-1 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schedule Your Interview
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            {data?.interviewType?.replace('_', ' ')} · {data?.duration} minutes
          </p>
        </div>

        {/* Calendar & Slots */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Calendar */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-3">Select a Date</h3>
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                disabled={isDayDisabled}
                fromDate={availableFrom}
                toDate={availableTo}
                className="border border-neutral-200 rounded-lg p-2"
              />
            </div>

            {/* Time Slots */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-3">
                {selectedDate ? `Available Times – ${format(selectedDate, 'MMM d')}` : 'Select a date first'}
              </h3>
              {!selectedDate ? (
                <p className="text-sm text-neutral-400 italic">Pick a date to see available times</p>
              ) : slotsForDate.length === 0 ? (
                <p className="text-sm text-neutral-400 italic">No available slots on this date</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                  {slotsForDate.map((slot) => (
                    <button
                      key={slot._id}
                      type="button"
                      onClick={() => { setSelectedSlot(slot); setState('confirming'); }}
                      className={`px-3 py-2.5 text-sm rounded-lg border transition-all text-center ${
                        selectedSlot?._id === slot._id
                          ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                          : 'border-neutral-200 hover:border-primary-300 text-neutral-700'
                      }`}
                    >
                      {slot.startTime} – {slot.endTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Confirmation panel */}
          {state === 'confirming' && selectedSlot && (
            <div className="mt-6 border-t border-neutral-200 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-neutral-800">Confirm Your Details</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="you@email.com"
                  />
                </div>
              </div>

              <div className="bg-primary-50 rounded-lg p-3 text-sm text-primary-800">
                <p className="font-medium">
                  {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedSlot.startTime}
                </p>
                <p className="text-primary-600 text-xs mt-0.5">{data?.duration} minutes · {data?.interviewType?.replace('_', ' ')}</p>
              </div>

              {error && (
                <p className="text-sm text-error-600">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setState('select'); setSelectedSlot(null); }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || !candidateName.trim() || !candidateEmail.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Booking...' : 'Confirm Interview'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
