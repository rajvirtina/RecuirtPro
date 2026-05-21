/**
 * ProctoringMonitor — invisible wrapper that runs during an AI interview.
 *
 * Detection methods:
 *   1. Tab visibility  — document visibilitychange
 *   2. Window blur     — window blur (fires after 3-second grace period)
 *   3. Face detection  — face-api.js TinyFaceDetector every 10 s
 *   4. Copy/paste      — document copy event
 *
 * When VITE_ENABLE_PROCTORING !== "true" the component renders children
 * immediately without any monitoring.
 *
 * All detection is client-side. Only lightweight violation events
 * (+ optional small webcam snapshots for face violations) are sent to
 * the server. Raw video is never transmitted.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const PROCTORING_ENABLED = import.meta.env.VITE_ENABLE_PROCTORING === 'true';
const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api/v1';

// Minimum ms between identical violations (deduplication)
const DEDUPE_MS = 30_000;
// ms to wait after window blur before logging
const BLUR_GRACE_MS = 3_000;
// Face-detection interval in ms
const FACE_INTERVAL_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ViolationType = 'tab_switch' | 'window_blur' | 'multiple_faces' | 'no_face' | 'copy_attempt';
type Severity      = 'low' | 'medium' | 'high' | 'critical';

interface ViolationPayload {
  type:              ViolationType;
  severity:          Severity;
  timestamp:         string;
  screenshotBase64?: string;
}

interface Props {
  /** 64-char session token — passed to POST /proctoring/session/:sessionId/violation */
  sessionId: string;
  /** Parent can override monitoring state (e.g., pause during processing) */
  enabled?: boolean;
  children: ReactNode;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProctoringMonitor({ sessionId, enabled = true, children }: Props) {
  // If proctoring feature is globally disabled, render children with zero overhead
  if (!PROCTORING_ENABLED || !enabled) return <>{children}</>;
  return <ProctoringMonitorInner sessionId={sessionId}>{children}</ProctoringMonitorInner>;
}

function ProctoringMonitorInner({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const faceApiRef  = useRef<any>(null);          // lazily loaded face-api.js module
  const lastViolRef = useRef<Map<string, number>>(new Map());
  const blurTimerRef= useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceTimerRef= useRef<ReturnType<typeof setInterval> | null>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);

  // ── Deduplicated violation poster ──────────────────────────────────────────
  const postViolation = useCallback(async (payload: ViolationPayload) => {
    const now = Date.now();
    const lastTs = lastViolRef.current.get(payload.type) ?? 0;
    if (now - lastTs < DEDUPE_MS) return; // skip duplicate within 30 s
    lastViolRef.current.set(payload.type, now);

    // Friendly candidate toast (not alarming)
    if (payload.type === 'tab_switch' || payload.type === 'window_blur') {
      toast('Please keep this tab active during your interview', {
        icon:     '👁️',
        duration: 4000,
        style:    { fontSize: '14px' },
      });
    }

    try {
      await axios.post(`${API_BASE}/proctoring/session/${sessionId}/violation`, payload);
    } catch (err) {
      // Never disrupt the interview if reporting fails
      console.warn('[Proctoring] Violation POST failed:', err);
    }
  }, [sessionId]);

  // ── Webcam frame capture ────────────────────────────────────────────────────
  const captureFrame = useCallback((): string | undefined => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return undefined;

    try {
      const canvas = document.createElement('canvas');
      canvas.width  = 320;
      canvas.height = 240;
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.45);
    } catch {
      return undefined;
    }
  }, []);

  // ── Face detection ──────────────────────────────────────────────────────────
  const detectFaces = useCallback(async () => {
    const faceapi = faceApiRef.current;
    const video   = videoRef.current;
    if (!faceapi || !video || video.readyState < 2) return;

    try {
      const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      );
      const count = detections.length;

      if (count === 0) {
        await postViolation({
          type:              'no_face',
          severity:          'high',
          timestamp:         new Date().toISOString(),
          screenshotBase64:  captureFrame(),
        });
      } else if (count > 1) {
        await postViolation({
          type:              'multiple_faces',
          severity:          'medium',
          timestamp:         new Date().toISOString(),
          screenshotBase64:  captureFrame(),
        });
      }
    } catch (err) {
      console.warn('[Proctoring] Face detection error:', err);
    }
  }, [postViolation, captureFrame]);

  // ── Initialise webcam + load face-api models ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // 1. Start webcam (required for face detection)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {/* autoplay blocked */});
        }
      } catch {
        console.warn('[Proctoring] Webcam access denied — face detection disabled');
        return; // continue with other detections
      }

      // 2. Dynamically import face-api.js (avoids loading TensorFlow.js when disabled)
      try {
        const faceapi = await import('face-api.js');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        if (cancelled) return;
        faceApiRef.current = faceapi;
        setModelsLoaded(true);
      } catch (err) {
        console.warn('[Proctoring] Face API models unavailable — face detection disabled:', err);
      }
    };

    init();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Start face-detection interval once models are ready ───────────────────
  useEffect(() => {
    if (!modelsLoaded) return;
    faceTimerRef.current = setInterval(detectFaces, FACE_INTERVAL_MS);
    return () => {
      if (faceTimerRef.current) clearInterval(faceTimerRef.current);
    };
  }, [modelsLoaded, detectFaces]);

  // ── Tab visibility detection ─────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        postViolation({
          type:      'tab_switch',
          severity:  'medium',
          timestamp: new Date().toISOString(),
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [postViolation]);

  // ── Window blur (3-second grace period before logging) ──────────────────
  useEffect(() => {
    const onBlur = () => {
      blurTimerRef.current = setTimeout(() => {
        postViolation({
          type:      'window_blur',
          severity:  'low',
          timestamp: new Date().toISOString(),
        });
      }, BLUR_GRACE_MS);
    };
    const onFocus = () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };
    window.addEventListener('blur',  onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      window.removeEventListener('blur',  onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [postViolation]);

  // ── Copy/paste detection ──────────────────────────────────────────────────
  useEffect(() => {
    const onCopy = () =>
      postViolation({
        type:      'copy_attempt',
        severity:  'low',
        timestamp: new Date().toISOString(),
      });
    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, [postViolation]);

  return (
    <>
      {/* Hidden webcam video element for face detection */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        style={{
          position:   'fixed',
          top:        '-9999px',
          left:       '-9999px',
          width:      320,
          height:     240,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />

      {/* Subtle monitoring indicator shown inside the interview UI */}
      <div
        className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-xs text-gray-300 select-none pointer-events-none"
        aria-label="Interview monitoring is active"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
        Monitoring active
      </div>

      {children}
    </>
  );
}
