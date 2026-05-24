/**
 * VoiceRecorder
 *
 * Dual-API voice capture:
 *  - MediaRecorder  → captures audio/webm blob → base64 for backend storage
 *  - Web Speech API → live transcription → sends text to parent via onTranscript
 *
 * CSS waveform: three concentric rings with staggered border-radius pulse animations
 * triggered only while recording.
 *
 * Props:
 *  onTranscript(text)   – called with accumulated transcription as it grows
 *  onAudioBase64(b64)   – called once when recording stops
 *  onPermissionDenied() – called when microphone access is refused
 *  transcript           – current text (controlled from parent)
 *  disabled             – disables interaction
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Web Speech API shim ──────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface Props {
  transcript: string;
  onTranscript: (text: string) => void;
  onAudioBase64?: (base64: string) => void;
  onPermissionDenied?: () => void;
  disabled?: boolean;
}

// ─── Waveform ring CSS injected once ─────────────────────────────────────────
const WAVEFORM_STYLE = `
@keyframes voiceRing {
  0%   { transform: scale(0.9);  opacity: 0.55; border-radius: 50%; }
  35%  { border-radius: 45% 55% 58% 42% / 50% 50% 54% 46%; }
  70%  { transform: scale(1.25); opacity: 0.15; border-radius: 52% 48% 44% 56% / 46% 54% 50% 50%; }
  100% { transform: scale(1.4);  opacity: 0;    border-radius: 50%; }
}
`;

let styleInjected = false;
function ensureWaveformStyle() {
  if (styleInjected) return;
  const el = document.createElement('style');
  el.textContent = WAVEFORM_STYLE;
  document.head.appendChild(el);
  styleInjected = true;
}

// ─── Component ────────────────────────────────────────────────────────────────

function fmtSec(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function VoiceRecorder({
  transcript,
  onTranscript,
  onAudioBase64,
  onPermissionDenied,
  disabled = false,
}: Props) {
  const [isRecording, setIsRecording]       = useState(false);
  const [recordingSec, setRecordingSec]     = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // Speech recognition ref
  const recognitionRef   = useRef<any>(null);
  const finalTranscript  = useRef('');

  // Ref that mirrors isRecording state — avoids stale closure in rec.onend callback
  const isRecordingRef   = useRef(false);

  useEffect(() => {
    ensureWaveformStyle();
    return () => stopRecording();
  }, []);

  // ── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording || disabled) return;

    try {
      // 1. Acquire microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // 2. MediaRecorder for audio blob
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType ?? 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        if (onAudioBase64) {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = (reader.result as string).split(',')[1];
            onAudioBase64(b64);
          };
          reader.readAsDataURL(blob);
        }
      };

      recorder.start(200); // chunk every 200 ms

      // 3. Web Speech API for live transcription (best-effort)
      if (SpeechRecognitionAPI) {
        finalTranscript.current = transcript; // carry over existing text
        const rec = new SpeechRecognitionAPI();
        rec.continuous     = true;
        rec.interimResults = true;
        rec.lang           = 'en-US';

        rec.onresult = (e: any) => {
          let finalAdd = '';
          let interim  = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              finalAdd += e.results[i][0].transcript + ' ';
            } else {
              interim += e.results[i][0].transcript;
            }
          }
          if (finalAdd) finalTranscript.current += finalAdd;
          onTranscript((finalTranscript.current + interim).trimStart());
        };

        rec.onerror = (e: any) => {
          if (e.error !== 'no-speech') console.warn('Speech API error:', e.error);
        };
        rec.onend = () => {
          // Auto-restart if still recording (browser stops after ~60 s).
          // Use isRecordingRef rather than isRecording to avoid the stale
          // closure: isRecording would always be `false` here because the
          // callback is created before setIsRecording(true) fires.
          if (isRecordingRef.current) {
            try { rec.start(); } catch { /* ignore */ }
          }
        };

        recognitionRef.current = rec;
        try { rec.start(); } catch { /* browser may deny mid-session */ }
      }

      // 4. Elapsed recording timer
      setRecordingSec(0);
      timerRef.current = setInterval(() => setRecordingSec(s => s + 1), 1000);

      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        onPermissionDenied?.();
      } else {
        console.error('Microphone error:', err);
      }
    }
  }, [isRecording, disabled, transcript, onTranscript, onAudioBase64, onPermissionDenied]);

  // ── Stop recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    recognitionRef.current?.stop();
    recognitionRef.current = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  // ── Permission denied fallback ───────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning-200 rounded-xl text-sm text-warning-800">
        <svg className="w-5 h-5 shrink-0 mt-0.5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span>Microphone access denied — switched to text mode automatically.</span>
      </div>
    );
  }

  // ── Waveform ring styles ─────────────────────────────────────────────────────
  const rings = [
    { size: 160, delay: '0s',    duration: '1.6s' },
    { size: 136, delay: '0.25s', duration: '1.3s' },
    { size: 112, delay: '0.5s',  duration: '1.0s' },
  ];

  return (
    <div className="flex flex-col items-center gap-5 py-6 select-none">

      {/* Waveform + mic button */}
      <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>

        {/* Concentric border-radius pulse rings */}
        {rings.map(({ size, delay, duration }, i) => (
          <div
            key={i}
            style={{
              position:  'absolute',
              width:  size,
              height: size,
              borderRadius: '50%',
              border:  '2px solid #6366f1', // primary-500
              animation: isRecording
                ? `voiceRing ${duration} ease-out infinite`
                : 'none',
              animationDelay: delay,
              opacity: isRecording ? 0.5 - i * 0.1 : 0,
              transition: 'opacity 0.3s',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Centre button */}
        <button
          onClick={toggle}
          disabled={disabled}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          className={[
            'relative z-10 w-20 h-20 rounded-full flex items-center justify-center',
            'transition-all duration-200 shadow-lg focus:outline-none focus-visible:ring-4',
            isRecording
              ? 'bg-error-500 hover:bg-error-600 focus-visible:ring-error-300 scale-110'
              : 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-300',
            disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          {isRecording ? (
            /* Stop icon */
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            /* Mic icon */
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
      </div>

      {/* Status label */}
      {isRecording ? (
        <div className="flex items-center gap-2 text-sm font-medium text-error-600">
          <span className="w-2.5 h-2.5 bg-error-500 rounded-full animate-pulse" />
          Recording… {fmtSec(recordingSec)}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          {SpeechRecognitionAPI
            ? 'Tap to speak — text will appear automatically'
            : 'Tap to record your answer'}
        </p>
      )}

      {/* Live transcript preview */}
      {transcript && (
        <div className="w-full max-w-lg bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
          {transcript}
          {isRecording && (
            <span className="inline-block w-0.5 h-4 bg-primary-500 ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>
      )}
    </div>
  );
}
