import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/api';
import { io, Socket } from 'socket.io-client';

interface Interview {
  _id: string;
  job?: { title: string };
  candidate?: { firstName: string; lastName: string };
  scheduledTime: string;
  duration: number;
  status: string;
  round?: string;
  proctoringEnabled?: boolean;
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
}

interface ChatMessage {
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VideoMeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const hasJoinedRoomRef = useRef(false);

  useEffect(() => {
    if (id) {
      initializeMeeting();
    }

    return () => {
      cleanup();
    };
  }, [id]);

  // Debug: Log participants state changes
  useEffect(() => {
    console.log('📊 PARTICIPANTS STATE CHANGED:');
    console.log('Total participants:', participants.size);
    console.log('Participants list:', Array.from(participants.values()).map(p => `${p.userName} (${p.socketId.substring(0, 8)}...)`));
  }, [participants]);

  const initializeMeeting = async () => {
    try {
      // Clear any stale state
      setParticipants(new Map());
      peerConnectionsRef.current.clear();
      hasJoinedRoomRef.current = false;
      
      // Fetch interview details
      const response = await apiClient.get(`/interviews/${id}`);
      if (response.success && response.data) {
        setInterview(response.data);
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect to Socket.IO
      connectSocket();
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error initializing meeting:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
      navigate('/interviews');
    }
  };

  const connectSocket = () => {
    // Prevent multiple socket connections
    if (socketRef.current && socketRef.current.connected) {
      console.log('Socket already connected, skipping');
      return;
    }

    const token = localStorage.getItem('token');
    const socket = io('http://localhost:5001', {
      auth: { token },
      transports: ['websocket', 'polling'],
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
          userName: `${user?.firstName} ${user?.lastName}`,
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
    });

    socket.on('recording-stopped', () => {
      setIsRecording(false);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  };

  const createPeerConnection = (socketId: string, isInitiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(socketId, pc);

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', socketId);
      setParticipants((prev) => {
        const newMap = new Map(prev);
        const participant = newMap.get(socketId);
        if (participant) {
          newMap.set(socketId, { ...participant, stream: event.streams[0] });
        }
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: socketId,
          candidate: event.candidate,
          from: socketRef.current.id,
        });
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (socketRef.current) {
            socketRef.current.emit('webrtc-offer', {
              to: socketId,
              offer: pc.localDescription,
              from: socketRef.current.id,
            });
          }
        })
        .catch((err) => console.error('Error creating offer:', err));
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
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

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

    // Restore camera track
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
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

  const cleanup = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Joining meeting...</p>
        </div>
      </div>
    );
  }

  const jobTitle = interview?.job?.title || 'Interview';
  const candidateName = interview?.candidate
    ? `${interview.candidate.firstName} ${interview.candidate.lastName}`
    : 'Candidate';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">{jobTitle}</h1>
            {isRecording && (
              <span className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Recording
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
        {/* Video Grid */}
        <div className="flex-1 p-4 grid grid-cols-2 gap-4 auto-rows-fr">
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

          {/* Remote Participants */}
          {Array.from(participants.values()).map((participant) => (
            <RemoteVideo key={participant.socketId} participant={participant} />
          ))}

          {/* Empty slots */}
          {participants.size === 0 && (
            <div className="bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Waiting for others to join...</p>
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

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4 flex-shrink-0">
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
      </div>
    </div>
  );
}

// Remote Video Component
function RemoteVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden">
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
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
      
      {/* Name and Mic Status Badge */}
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/70 text-white text-sm rounded flex items-center gap-2">
        <span>{participant.userName}</span>
        {!participant.micEnabled && (
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </div>
    </div>
  );
}
