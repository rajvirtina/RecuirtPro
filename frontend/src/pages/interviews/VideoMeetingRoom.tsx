import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { recordingPulse, scaleVariants } from '../../lib/motion';

interface Interview {
  _id: string;
  // Backend populates these as jobId / candidateId — accept both shapes
  job?: { title: string };
  jobId?: { title: string } | string;
  candidate?: { firstName: string; lastName: string };
  candidateId?: { firstName: string; lastName: string } | string;
  scheduledTime: string;
  duration: number;
  status: string;
  round?: string;
  proctoringEnabled?: boolean;
  metadata?: {
    systemCheckCompleted?: boolean;
    systemCheckTimestamp?: string;
    systemCheckPassed?: boolean;
    systemCheckViolations?: string[];
  };
}

/** Safe helper — backend populates jobId/candidateId but some callers use job/candidate */
function getJobTitle(i: Interview | null): string {
  if (!i) return 'Interview';
  const j = (i.job ?? (typeof i.jobId === 'object' ? i.jobId : null)) as any;
  return j?.title ?? 'Interview';
}
function getCandidateName(i: Interview | null): string {
  if (!i) return 'Candidate';
  const c = (i.candidate ?? (typeof i.candidateId === 'object' ? i.candidateId : null)) as any;
  return c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : 'Candidate';
}

interface Participant {
  socketId: string;
  userId: string;
  userName: string;
  userRole: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  cameraEnabled: boolean;
  micEnabled: boolean;
  screenSharing: boolean;
  /** ICE connection state — drives the quality badge in the video tile. */
  iceState?: RTCIceConnectionState;
}

/** Maximum occupancy: 1 candidate + up to 3 interviewers.  Must match MAX_PANEL_SIZE in socketController.ts. */
const MAX_PARTICIPANTS = 4;

interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
}

/**
 * Socket URL resolution:
 *   - Prefer VITE_SOCKET_URL env var (set in .env.production for the Hostinger deployment)
 *   - On localhost fall back to the local dev backend (port 5001)
 *   - In production use window.location.origin so the socket connects to
 *     the same domain served by Nginx (which proxies to the backend)
 */
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5001');

/**
 * ICE server configuration — STUN + TURN for full firewall traversal.
 *
 * Priority:
 *   1. Your self-hosted coturn (docker-compose.yml) via VITE_TURN_* env vars  ← production
 *   2. openrelay.metered.ca free public TURN                                   ← dev fallback only
 *
 * To use your own TURN server add to frontend/.env:
 *   VITE_TURN_SERVER_URL=turn:YOUR_VPS_IP:3478
 *   VITE_TURN_USERNAME=recruitpro
 *   VITE_TURN_PASSWORD=your-strong-turn-password-here
 */
const _TURN_URL  = import.meta.env.VITE_TURN_SERVER_URL as string | undefined;
const _TURN_USER = import.meta.env.VITE_TURN_USERNAME   as string | undefined;
const _TURN_PASS = import.meta.env.VITE_TURN_PASSWORD   as string | undefined;
const _USE_CUSTOM_TURN = Boolean(_TURN_URL && _TURN_USER && _TURN_PASS);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // STUN — fast path for peers on the same network or with open NAT
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    // TURN — relay path for strict NAT / corporate firewalls
    ...(_USE_CUSTOM_TURN
      ? [
          // Primary: TURN (UDP + TCP)
          { urls: _TURN_URL!,                              username: _TURN_USER!, credential: _TURN_PASS! },
          { urls: `${_TURN_URL}?transport=tcp`,            username: _TURN_USER!, credential: _TURN_PASS! },
          // Secondary: TURNS over TLS (port 5349) — penetrates HTTPS-only proxies
          { urls: _TURN_URL!.replace(/^turn:/, 'turns:').replace(/:3478$/, ':5349'),
            username: _TURN_USER!, credential: _TURN_PASS! },
        ]
      : [
          // Dev-only fallback — free shared TURN, unreliable for production
          { urls: 'turn:openrelay.metered.ca:80',              username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443',             username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ]),
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export default function VideoMeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinToken = searchParams.get('token');        // public token from email link
  const user            = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // authReady: proceed once we know if visitor has a session or is a token-only guest
  const authReady = !!joinToken || isAuthenticated;
  
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const hasJoinedRoomRef = useRef(false);
  /** Mirror of participants state — readable inside event-handler closures. */
  const participantsRef = useRef<Map<string, Participant>>(new Map());
  /** MediaRecorder for local recording (interviewer side only). */
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Updated each render — lets stale socket closures always call fresh recording logic. */
  const startRecordingRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Wait until we know auth state before fetching interview data.
    // Without this guard, HR users hit the API before useAuthStore.user resolves
    // and the room logic runs as if unauthenticated.
    if (!id || !authReady) return;
    initializeMeeting();

    return () => {
      cleanup();
    };
  }, [id, authReady]);

  // Attach the local stream to the video element once both are available.
  // The video element only exists in the DOM after loading=false, so we cannot
  // do this assignment inline in initializeMeeting (localVideoRef.current is null then).
  useEffect(() => {
    if (!localStream || !localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.play().catch(() => {/* autoplay policy — harmless */});
  }, [localStream, loading]);  // re-run when loading flips to false (video element mounts)

  // Keep recording function refs fresh — socket handlers capture the ref, not the closure value.
  startRecordingRef.current = () => {
    const videoTracks: MediaStreamTrack[] = [];
    const audioTracks: MediaStreamTrack[] = [];
    localStreamRef.current?.getVideoTracks().forEach(t => videoTracks.push(t));
    localStreamRef.current?.getAudioTracks().forEach(t => audioTracks.push(t));
    participantsRef.current.forEach(p => {
      p.stream?.getVideoTracks().forEach(t => videoTracks.push(t));
      p.stream?.getAudioTracks().forEach(t => audioTracks.push(t));
    });
    if (!videoTracks.length && !audioTracks.length) return;

    const composite = new MediaStream([...videoTracks, ...audioTracks]);
    const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus'))
      ? 'video/webm;codecs=vp9,opus' : 'video/webm';

    const recorder = new MediaRecorder(composite, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      if (!blob.size) return;
      setIsUploadingRecording(true);
      try {
        const fd = new FormData();
        fd.append('recording', blob, `recording-${id}-${Date.now()}.webm`);
        await apiClient.post(`/interviews/${id}/recording`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Recording saved successfully');
      } catch {
        toast.error('Failed to save recording — please contact support');
      } finally {
        setIsUploadingRecording(false);
        chunksRef.current = [];
      }
    };
    recorder.start(1000);
    recorderRef.current = recorder;
  };

  stopRecordingRef.current = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  };

  // Keep participantsRef in sync so event-handler closures can read current state.
  useEffect(() => {
    participantsRef.current = participants;
    console.log('📊 PARTICIPANTS STATE CHANGED:');
    console.log('Total participants:', participants.size);
    console.log('Participants list:', Array.from(participants.values()).map(p => `${p.userName} (${p.socketId.substring(0, 8)}...)`));
  }, [participants]);

  // Derived panel-size warning (re-computed on every render — no extra state needed).
  const totalInRoom = participants.size + 1; // +1 = local user
  const panelWarning: 'approaching' | 'full' | null =
    totalInRoom >= MAX_PARTICIPANTS       ? 'full'
    : totalInRoom >= MAX_PARTICIPANTS - 1 ? 'approaching'
    : null;

  const initializeMeeting = async () => {
    try {
      // Clear any stale state
      setParticipants(new Map());
      peerConnectionsRef.current.clear();
      hasJoinedRoomRef.current = false;
      
      // Fetch interview details — public endpoint when candidate arrives via join token
      let interviewData: Interview | null = null;
      if (joinToken && !user) {
        const pubRes = await apiClient.get(`/interviews/${id}/public?token=${joinToken}`);
        if (pubRes.success && pubRes.data) {
          interviewData = pubRes.data as Interview;
        }
      } else {
        const response = await apiClient.get(`/interviews/${id}`);
        if (response.success && response.data) interviewData = response.data;
      }

      if (!interviewData) {
        setMediaError('Interview not found or access denied.');
        setLoading(false);
        return;
      }
      setInterview(interviewData);

      // Check if proctoring is enabled and system check is required
      if (interviewData.proctoringEnabled && (user?.role === 'candidate' || (!user && joinToken))) {
        const systemCheckCompleted = interviewData.metadata?.systemCheckCompleted;
        if (!systemCheckCompleted) {
          navigate(`/proctoring-check/${id}?token=${joinToken || ''}`, { replace: true });
          return;
        }
      }

      // Start the interview if not already started (skip for unauthenticated/token access)
      if ((user || joinToken) && (interviewData.status === 'scheduled' || interviewData.status === 'confirmed')) {
        if (user) {
          const startResponse = await apiClient.post(`/interviews/${id}/start`);
          if (startResponse.success) setInterview(startResponse.data);
        }
      } else if (interviewData.status === 'completed') {
        setMediaError('This interview has already been completed.');
        setLoading(false);
        return;
      } else if (interviewData.status === 'cancelled') {
        setMediaError('This interview has been cancelled.');
        setLoading(false);
        return;
      }

      // Get user media with full permission + device-enumeration check
      const stream = await initializeMediaDevices();
      localStreamRef.current = stream;
      // Store in state so the useEffect can attach it to the video element
      // after setLoading(false) makes the <video> element appear in the DOM.
      setLocalStream(stream);

      // Connect to Socket.IO
      connectSocket();
      setLoading(false);
    } catch (error: any) {
      console.error('Error initializing meeting:', error);
      setLoading(false);
      setMediaError(error.message || 'Failed to access camera/microphone. Please check your browser permissions.');
    }
  };

  /** Full device-enumeration + permission check before requesting stream */
  const initializeMediaDevices = async (): Promise<MediaStream> => {
    const MEDIA_ERRORS: Record<string, string> = {
      NotAllowedError:   'Camera/microphone access is blocked. Please click the lock icon in the address bar and allow access.',
      NotFoundError:     'No camera or microphone detected. Please connect your devices and refresh.',
      NotReadableError:  'Camera or microphone is already in use by another application. Close it and retry.',
      OverconstrainedError: 'Your camera does not support the requested resolution. Retrying with lower quality.',
      PERMISSION_DENIED: 'Camera/microphone access is denied. Please allow access in your browser settings and refresh.',
      DEVICE_NOT_FOUND:  'No camera or microphone found. Please connect your devices.',
    };

    // 1. Check Permissions API (Chrome / Edge)
    try {
      const [camPerm, micPerm] = await Promise.all([
        navigator.permissions.query({ name: 'camera' as PermissionName }),
        navigator.permissions.query({ name: 'microphone' as PermissionName }),
      ]);
      if (camPerm.state === 'denied' || micPerm.state === 'denied') {
        throw Object.assign(new Error('PERMISSION_DENIED'), { name: 'PERMISSION_DENIED' });
      }
    } catch (permErr: any) {
      if (permErr.name === 'PERMISSION_DENIED') throw new Error(MEDIA_ERRORS.PERMISSION_DENIED);
      // Permissions API not supported in this browser — fall through
    }

    // 2. Enumerate devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some(d => d.kind === 'videoinput');
    const hasMic    = devices.some(d => d.kind === 'audioinput');
    if (!hasCamera || !hasMic) {
      throw new Error(MEDIA_ERRORS.DEVICE_NOT_FOUND);
    }

    // 3. Request stream
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err: any) {
      // Fallback: retry with lower constraints if OverconstrainedError
      if (err.name === 'OverconstrainedError') {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      throw new Error(MEDIA_ERRORS[err.name] || `Media access failed: ${err.message}`);
    }
  };

  const connectSocket = () => {
    // Prevent multiple socket connections
    if (socketRef.current && socketRef.current.connected) {
      console.log('Socket already connected, skipping');
      return;
    }

    // Use JWT for authenticated users; fall back to joinToken for public-link candidates
    const socketAuth = localStorage.getItem('token') || joinToken;
    const socket = io(SOCKET_URL, {
      auth: { token: socketAuth },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      // Only join the meeting once, not on reconnects
      if (!hasJoinedRoomRef.current) {
        hasJoinedRoomRef.current = true;
        console.log('Joining meeting room for the first time');
        socket.emit('join-meeting', {
          interviewId: id,
          userName: user
            ? `${user.firstName} ${user.lastName}`
            : (interview?.candidate ? `${(interview.candidate as any).firstName} ${(interview.candidate as any).lastName}` : 'Candidate'),
          userRole: user?.role,
        });
      } else {
        console.log('Socket reconnected, but already joined room');
      }
    });

    socket.on('existing-participants', ({ participants: existingParticipants }) => {
      console.log('=== EXISTING PARTICIPANTS EVENT ===');
      console.log('Received participants:', existingParticipants);
      console.log('Current participants Map before update:', Array.from(participants.entries()));
      
      // Add existing participants to state and create peer connections
      existingParticipants.forEach((participant: any) => {
        const { socketId, userName, userRole } = participant;
        
        console.log(`Processing existing participant: ${userName} (${socketId})`);
        
        // Add to participants Map (or update if already exists)
        setParticipants((prev) => {
          const newMap = new Map(prev);
          console.log(`Map has ${newMap.size} participants before adding ${userName}`);
          
          // Only add if not already in the map
          if (!newMap.has(socketId)) {
            newMap.set(socketId, {
              socketId,
              userId: socketId,
              userName,
              userRole,
              cameraEnabled: true,
              micEnabled: true,
              screenSharing: false,
            });
            console.log(`✓ Added ${userName} to map. New size: ${newMap.size}`);
          } else {
            console.log(`✗ ${userName} already exists in map, skipping`);
          }
          
          console.log('Final map entries:', Array.from(newMap.entries()).map(([k, v]) => `${v.userName} (${k})`));
          return newMap;
        });
        
        // Create peer connection (we are the initiator) - only if not already exists
        if (!peerConnectionsRef.current.has(socketId)) {
          console.log(`Creating peer connection for: ${userName}`);
          createPeerConnection(socketId, true);
        } else {
          console.log(`Peer connection already exists for: ${userName}`);
        }
      });
    });

    socket.on('user-joined', ({ socketId, userName, userRole }) => {
      console.log('=== USER JOINED EVENT ===');
      console.log(`User: ${userName}, socketId: ${socketId}, mySocketId: ${socket.id}`);

      // Critical: Don't add ourselves to the participants list
      if (socketId === socket.id) {
        console.warn('⚠️ Received user-joined for SELF, ignoring');
        return;
      }

      // Client-side cap: participants Map is remote-only, so size >= MAX_PARTICIPANTS-1
      // means local + remotes already fills the room.  Server enforces the same limit;
      // this guard prevents a stale/racing event from adding a ghost tile.
      if (participantsRef.current.size >= MAX_PARTICIPANTS - 1) {
        console.warn(`⚠️ Panel full (${MAX_PARTICIPANTS} max). Ignoring late user-joined for ${userName}.`);
        toast.error(`Maximum ${MAX_PARTICIPANTS} participants for video interviews. Contact support for larger panels.`);
        socket.emit('leave-meeting', { interviewId: id, userName });
        return;
      }
      
      setParticipants((prev) => {
        const newMap = new Map(prev);
        console.log(`Map has ${newMap.size} participants before adding ${userName}`);
        
        // Only add if not already in the map
        if (!newMap.has(socketId)) {
          newMap.set(socketId, {
            socketId,
            userId: socketId,
            userName,
            userRole,
            cameraEnabled: true,
            micEnabled: true,
            screenSharing: false,
          });
          console.log(`✓ Added ${userName} to map. New size: ${newMap.size}`);
        } else {
          console.log(`✗ ${userName} already exists in map, skipping`);
        }
        
        console.log('Final map entries:', Array.from(newMap.entries()).map(([k, v]) => `${v.userName} (${k})`));
        return newMap;
      });
      
      // Don't create peer connection here - wait for offer
    });

    socket.on('webrtc-offer', async ({ from, offer }) => {
      console.log('Received offer from:', from);
      const pc = createPeerConnection(from, false);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc-answer', {
        to: from,
        answer: pc.localDescription,
        from: socket.id,
      });
    });

    socket.on('webrtc-answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-left', ({ socketId, userName }) => {
      console.log('User left:', userName);
      const pc = peerConnectionsRef.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(socketId);
      }
      
      setParticipants((prev) => {
        const newMap = new Map(prev);
        newMap.delete(socketId);
        return newMap;
      });
    });

    socket.on('participant-camera-toggle', ({ socketId, cameraEnabled }) => {
      setParticipants((prev) => {
        const newMap = new Map(prev);
        const participant = newMap.get(socketId);
        if (participant) {
          newMap.set(socketId, { ...participant, cameraEnabled });
        }
        return newMap;
      });
    });

    socket.on('participant-mic-toggle', ({ socketId, micEnabled }) => {
      setParticipants((prev) => {
        const newMap = new Map(prev);
        const participant = newMap.get(socketId);
        if (participant) {
          newMap.set(socketId, { ...participant, micEnabled });
        }
        return newMap;
      });
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('recording-started', () => {
      setIsRecording(true);
      startRecordingRef.current();
    });

    socket.on('recording-stopped', () => {
      setIsRecording(false);
      stopRecordingRef.current();
    });

    socket.on('error', ({ message, code }: { message: string; code?: string }) => {
      console.error('Socket error:', code, message);
      if (code === 'ROOM_FULL') {
        setMediaError(message);
      } else {
        toast.error(message);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  };

  const createPeerConnection = (socketId: string, isInitiator: boolean): RTCPeerConnection => {
    console.log(`🔌 Creating peer connection for ${socketId}, isInitiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(socketId, pc);

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`➕ Adding local track: ${track.kind} (${track.label})`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      console.log(`📥 Received remote track from ${socketId}:`, event.track.kind);
      console.log('Remote stream ID:', event.streams[0]?.id);
      console.log('Remote stream tracks:', event.streams[0]?.getTracks().map(t => `${t.kind} - ${t.enabled}`));
      
      setParticipants((prev) => {
        const newMap = new Map(prev);
        const participant = newMap.get(socketId);
        if (participant) {
          console.log(`✅ Updating participant ${participant.userName} with stream`);
          newMap.set(socketId, { ...participant, stream: event.streams[0] });
        } else {
          console.warn(`⚠️ Received track for unknown participant: ${socketId}`);
        }
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log(`🧊 Sending ICE candidate to ${socketId}`);
        socketRef.current.emit('ice-candidate', {
          to: socketId,
          candidate: event.candidate,
          from: socketRef.current.id,
        });
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${socketId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.error(`❌ Connection ${pc.connectionState} for ${socketId}`);
      }
    };

    // ICE connection state — drives quality badge + audio-only fallback.
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      const peerName = participantsRef.current.get(socketId)?.userName ?? 'participant';
      console.log(`❄️ ICE connection state for ${socketId} (${peerName}): ${state}`);

      // Push state into participant so RemoteVideo can render a badge.
      setParticipants((prev) => {
        const newMap = new Map(prev);
        const p = newMap.get(socketId);
        if (p) newMap.set(socketId, { ...p, iceState: state });
        return newMap;
      });

      if (state === 'failed') {
        toast.error(
          `Video connection with ${peerName} failed — switching to audio-only. Check your network or firewall settings.`,
          { duration: 8000 }
        );
        // Audio-only fallback: disable outbound video on this peer connection.
        // Audio tracks are unaffected and the connection attempt continues.
        pc.getSenders()
          .filter((s) => s.track?.kind === 'video')
          .forEach((s) => { if (s.track) s.track.enabled = false; });
      } else if (state === 'disconnected') {
        toast.warning(`Connection with ${peerName} is unstable — attempting to reconnect…`, { duration: 5000 });
      } else if (state === 'connected') {
        console.log(`✅ ICE connected with ${peerName}`);
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      console.log(`📤 Creating offer for ${socketId}`);
      pc.createOffer()
        .then((offer) => {
          console.log(`📝 Setting local description for ${socketId}`);
          return pc.setLocalDescription(offer);
        })
        .then(() => {
          if (socketRef.current) {
            console.log(`📨 Sending offer to ${socketId}`);
            socketRef.current.emit('webrtc-offer', {
              to: socketId,
              offer: pc.localDescription,
              from: socketRef.current.id,
            });
          }
        })
        .catch((err) => console.error('❌ Error creating offer:', err));
    }

    return pc;
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
        
        if (socketRef.current) {
          socketRef.current.emit('toggle-camera', {
            interviewId: id,
            enabled: videoTrack.enabled,
          });
        }
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        
        if (socketRef.current) {
          socketRef.current.emit('toggle-microphone', {
            interviewId: id,
            enabled: audioTrack.enabled,
          });
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        screenStreamRef.current = screenStream;

        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });

        // Update local preview via state so the useEffect re-attaches
        setLocalStream(screenStream);

        setScreenSharing(true);
        
        if (socketRef.current) {
          socketRef.current.emit('screen-share-started', { interviewId: id });
        }

        // Handle screen share stop
        videoTrack.onended = () => {
          stopScreenShare();
        };
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    // Restore camera track in all peer connections and re-attach local preview
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });
      // Re-trigger the useEffect that attaches the camera stream back to the local video element
      setLocalStream(localStreamRef.current);
    }

    setScreenSharing(false);
    
    if (socketRef.current) {
      socketRef.current.emit('screen-share-stopped', { interviewId: id });
    }
  };

  const sendChatMessage = () => {
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('chat-message', {
        interviewId: id,
        message: chatInput.trim(),
        userName: `${user?.firstName} ${user?.lastName}`,
      });
      setChatInput('');
    }
  };

  const toggleRecording = () => {
    if (socketRef.current) {
      if (isRecording) {
        socketRef.current.emit('stop-recording', { interviewId: id });
      } else {
        socketRef.current.emit('start-recording', { interviewId: id });
      }
    }
  };

  const endMeeting = () => {
    if (confirm('Are you sure you want to end the interview?')) {
      cleanup();
      navigate('/interviews');
    }
  };

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  const cleanup = () => {
    // Stop active recording before leaving (uploads the blob if recording was in progress)
    stopRecordingRef.current();

    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave-meeting', {
        interviewId: id,
        userName: `${user?.firstName} ${user?.lastName}`,
      });
      socketRef.current.disconnect();
    }
    
    // Reset joined flag
    hasJoinedRoomRef.current = false;
  };

  const reduced = useReducedMotion();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          className="text-center"
          initial={reduced ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        >
          <motion.div
            className="rounded-full h-14 w-14 border-2 border-indigo-500 border-t-transparent mx-auto"
            animate={reduced ? {} : { rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
          <motion.p
            className="mt-5 text-gray-300 text-sm font-medium"
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            Joining meeting…
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Media or interview-state error — shown instead of the meeting room
  if (mediaError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
        <motion.div
          className="max-w-md w-full bg-gray-800 rounded-xl shadow-lg p-8 text-center space-y-5 border border-gray-700"
          variants={reduced ? undefined : scaleVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="w-16 h-16 bg-red-900/40 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Unable to Join Meeting</h2>
          <p className="text-gray-300 text-sm leading-relaxed">{mediaError}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setMediaError(null); setLocalStream(null); setLoading(true); initializeMeeting(); }}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/interviews')}
              className="w-full px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 font-medium transition-colors"
            >
              Back to Interviews
            </button>
          </div>
          <p className="text-xs text-gray-500">
            If camera/microphone access is blocked, click the 🔒 lock icon in your browser's address bar and allow access, then retry.
          </p>
        </motion.div>
      </div>
    );
  }

  const jobTitle = getJobTitle(interview);
  const candidateName = getCandidateName(interview);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col" onMouseMove={handleMouseMove}>
      {/* Panel size warning banner */}
      {panelWarning && (
        <div className={`px-4 py-2 text-sm font-medium text-center flex-shrink-0 ${
          panelWarning === 'full'
            ? 'bg-red-600 text-white'
            : 'bg-amber-500 text-amber-950'
        }`}>
          {panelWarning === 'full'
            ? `⚠️ Meeting is at capacity (${MAX_PARTICIPANTS} participants). No additional participants can join.`
            : `⚠️ Approaching participant limit (${totalInRoom}/${MAX_PARTICIPANTS}). This call supports up to ${MAX_PARTICIPANTS} people. For larger panels, use a dedicated video tool.`
          }
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">{jobTitle}</h1>
            <AnimatePresence>
            {isRecording && (
              <motion.span
                className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-xs font-medium"
                initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <motion.span
                  className="w-2 h-2 bg-white rounded-full"
                  variants={reduced ? undefined : recordingPulse}
                  initial="rest"
                  animate="pulsing"
                />
                Recording
              </motion.span>
            )}
            </AnimatePresence>
            {isUploadingRecording && (
              <span className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving recording…
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {user?.role !== 'candidate' && `${candidateName} • `}
              {interview?.round}
            </span>
            <button
              onClick={endMeeting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              End Interview
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid — auto-sizing based on participant count */}
        <div
          className={`flex-1 p-4 grid gap-4 auto-rows-fr ${
            participants.size === 0
              ? 'grid-cols-1'
              : participants.size === 1
              ? 'grid-cols-2'
              : participants.size <= 3
              ? 'grid-cols-2'
              : 'grid-cols-3'
          }`}
        >
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/70 text-white text-sm rounded">
              You {screenSharing && '(Sharing Screen)'}
            </div>
            {!cameraEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl text-white">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">Camera Off</p>
                </div>
              </div>
            )}
          </div>

          {/* Remote Participants — all of them, unlimited */}
          <AnimatePresence>
          {Array.from(participants.values()).map((participant) => (
            <motion.div
              key={participant.socketId}
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              <RemoteVideo participant={participant} />
            </motion.div>
          ))}
          </AnimatePresence>

          {/* Waiting placeholder — only when no one else has joined yet */}
          {participants.size === 0 && (
            <div className="bg-gray-800 rounded-lg flex items-center justify-center min-h-[200px]">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 border-2 border-gray-600 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">Waiting for others to join…</p>
                <p className="text-gray-600 text-xs">Share the interview link to invite participants</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">Chat</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <div className="font-medium text-indigo-400">{msg.userName}</div>
                  <div className="text-gray-300">{msg.message}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={sendChatMessage}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls — auto-hides after 3 s of inactivity */}
      <motion.div
        className="bg-gray-800 border-t border-gray-700 px-6 py-4 flex-shrink-0"
        animate={reduced ? {} : { opacity: controlsVisible ? 1 : 0, y: controlsVisible ? 0 : 8 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMicrophone}
            className={`p-4 rounded-full transition-colors ${
              micEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={micEnabled ? 'Mute' : 'Unmute'}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {micEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              )}
            </svg>
          </button>

          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-colors ${
              cameraEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition-colors ${
              screenSharing ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={screenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className="p-4 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors relative"
            title="Toggle chat"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {chatMessages.length > 0 && !showChat && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {chatMessages.length}
              </span>
            )}
          </button>

          {(user?.role === 'hr' || user?.role === 'employer' || user?.role === 'admin') && (
            <button
              onClick={toggleRecording}
              className={`p-4 rounded-full transition-colors ${
                isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                {isRecording ? (
                  <rect x="6" y="6" width="12" height="12" />
                ) : (
                  <circle cx="12" cy="12" r="8" />
                )}
              </svg>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Remote Video Component
function RemoteVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !participant.stream) return;
    videoRef.current.srcObject = participant.stream;
    videoRef.current.play().catch((err) => {
      // NotAllowedError = browser autoplay policy blocked — show click-to-play prompt
      if (err.name === 'NotAllowedError') {
        setNeedsClick(true);
      } else {
        console.warn('[RemoteVideo] play() failed:', err);
      }
    });
  }, [participant.stream]);

  const handleUserClick = () => {
    videoRef.current?.play().catch(() => {});
    setNeedsClick(false);
  };

  const handleLoadedMetadata = () => setIsVideoReady(true);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden">
      {participant.stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            onLoadedMetadata={handleLoadedMetadata}
          />

          {/* Autoplay blocked — user must tap to start audio/video */}
          {needsClick && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/60 cursor-pointer z-10"
              onClick={handleUserClick}
            >
              <div className="text-center">
                <svg className="w-12 h-12 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <p className="text-white text-sm font-medium">Click to start video</p>
              </div>
            </div>
          )}

          {/* Loading indicator while video is initializing */}
          {!isVideoReady && !needsClick && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                <p className="text-gray-300 text-sm">Loading video...</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl text-white">
                {participant.userName.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{participant.userName}</p>
            <p className="text-gray-400 text-xs mt-1">Connecting...</p>
          </div>
        </div>
      )}
      
      {/* Camera Off Overlay - shown on top of video when camera is disabled */}
      {!participant.cameraEnabled && participant.stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl text-white">
                {participant.userName.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{participant.userName}</p>
            <p className="text-gray-400 text-xs mt-1">Camera Off</p>
          </div>
        </div>
      )}
      
      {/* Name, Mic Status, and ICE quality badge */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="px-3 py-1 bg-black/70 text-white text-sm rounded flex items-center gap-2">
          <span>{participant.userName}</span>
          {!participant.micEnabled && (
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </div>
        <IceBadge state={participant.iceState} />
      </div>
    </div>
  );
}

/** Small ICE connection quality pill shown on each remote video tile. */
function IceBadge({ state }: { state?: RTCIceConnectionState }) {
  if (!state || state === 'new') return null;

  const config: Record<string, { label: string; cls: string }> = {
    checking:     { label: 'Connecting…', cls: 'bg-amber-500 text-amber-950' },
    connected:    { label: '● Connected',  cls: 'bg-green-600 text-white' },
    completed:    { label: '● Connected',  cls: 'bg-green-600 text-white' },
    disconnected: { label: '⚡ Unstable',  cls: 'bg-orange-500 text-white' },
    failed:       { label: '✕ Failed',     cls: 'bg-red-600 text-white' },
    closed:       { label: 'Closed',       cls: 'bg-gray-500 text-white' },
  };

  const { label, cls } = config[state] ?? { label: state, cls: 'bg-gray-600 text-white' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
