import { useEffect, useRef, useState, useCallback } from 'react';
import type { TranscriptItem } from './TranscriptViewer';

interface RecordingPlayerProps {
  recordingUrl: string;
  transcript?: TranscriptItem[];
  title?: string;
}

/** Estimate cumulative start offset (seconds) for each transcript item. */
function buildChapterOffsets(transcript: TranscriptItem[]): number[] {
  const QUESTION_BUFFER = 20; // seconds estimated for question display + thinking
  const offsets: number[] = [];
  let cursor = 0;
  for (const item of transcript) {
    offsets.push(cursor);
    cursor += QUESTION_BUFFER + (item.responseTimeSeconds || 60);
  }
  return offsets;
}

export function RecordingPlayer({ recordingUrl, transcript = [], title }: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [activeChapter, setActiveChapter] = useState(0);

  const offsets = buildChapterOffsets(transcript);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    if (v.paused) { v.play(); setIsPlaying(true); }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setCurrentTime(t);
    // Find active chapter
    let ch = 0;
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (t >= offsets[i]) { ch = i; break; }
    }
    setActiveChapter(ch);
  }, [offsets]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const vol = Number(e.target.value);
    if (v) v.volume = vol;
    setVolume(vol);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => setDuration(v.duration || 0);
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, []);

  const isAudio = /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(recordingUrl);

  return (
    <div className="card overflow-hidden">
      {/* Video/Audio element */}
      {isAudio ? (
        <audio
          ref={videoRef as React.RefObject<HTMLAudioElement>}
          src={recordingUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      ) : (
        <video
          ref={videoRef}
          src={recordingUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="w-full aspect-video bg-neutral-950 object-contain"
          playsInline
        />
      )}

      {isAudio && (
        <div className="flex items-center justify-center h-24 bg-neutral-950">
          <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          {title && <span className="ml-3 text-sm text-neutral-300 truncate max-w-xs">{title}</span>}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 bg-neutral-900 space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 tabular-nums w-10">{fmt(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleScrub}
            className="flex-1 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-primary-500"
            aria-label="Seek"
          />
          <span className="text-xs text-neutral-400 tabular-nums w-10 text-right">{fmt(duration)}</span>
        </div>

        {/* Play + volume */}
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center text-white transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 15.536a5 5 0 010-7.072" />
            </svg>
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-primary-500"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

      {/* Chapter list */}
      {transcript.length > 0 && (
        <div className="border-t border-neutral-200 max-h-64 overflow-y-auto">
          <p className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-50 border-b border-neutral-100">
            Questions
          </p>
          {transcript.map((item, i) => (
            <button
              key={item.questionNumber}
              onClick={() => seekTo(offsets[i])}
              className={`w-full text-left px-4 py-2.5 flex items-start gap-3 text-sm transition-colors border-b border-neutral-50 last:border-0 ${
                activeChapter === i ? 'bg-primary-50' : 'hover:bg-neutral-50'
              }`}
            >
              <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                activeChapter === i ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-600'
              }`}>
                {item.questionNumber}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold mb-0.5 ${
                  activeChapter === i ? 'text-primary-700' : 'text-neutral-500'
                }`}>
                  Q{item.questionNumber} · {item.questionType} · {fmt(offsets[i])}
                </p>
                <p className={`text-xs truncate ${
                  activeChapter === i ? 'text-primary-900' : 'text-neutral-700'
                }`}>
                  {item.question}
                </p>
              </div>
              <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                item.passed ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
              }`}>
                {item.passed ? '✓' : '✗'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
