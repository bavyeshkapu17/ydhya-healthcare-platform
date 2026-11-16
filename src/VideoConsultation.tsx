
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Camera,
  LoaderCircle,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import './VideoConsultation.css';

interface Props {
  consultationId: string;
  onClose: () => void;
}

interface ConsultationInfo {
  id: string;
  patient_id: string;
  doctor_id: string;
  consultation_mode: string;
  status: string;
}

interface SignalRow {
  id: string;
  consultation_id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended';
  payload: any;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function VideoConsultation({
  consultationId,
  onClose,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const userIdRef = useRef('');
  const recipientIdRef = useRef('');
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const handledSignalsRef = useRef<Set<string>>(new Set());
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const callEndedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Connecting to consultation...');
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [incomingOffer, setIncomingOffer] = useState(false);
  const [isDoctor, setIsDoctor] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);

  const sendSignal = useCallback(
    async (
      type: SignalRow['message_type'],
      payload: unknown = null,
    ) => {
      const userId = userIdRef.current;
      const recipientId = recipientIdRef.current;

      if (!userId || !recipientId) {
        throw new Error('Consultation participants are not ready.');
      }

      const { error: signalError } = await supabase
        .from('consultation_signals')
        .insert({
          consultation_id: consultationId,
          sender_id: userId,
          recipient_id: recipientId,
          message_type: type,
          payload,
        });

      if (signalError) throw signalError;
    },
    [consultationId],
  );

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    pendingCandidatesRef.current = [];
    incomingOfferRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setConnected(false);
    setMediaReady(false);
    setIncomingOffer(false);
    setCameraOn(false);
    setMicOn(false);
  }, []);

  // Request camera and microphone permission.
  const startMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access requires HTTPS or localhost.');
    }

    // Reuse an existing live stream instead of requesting another one.
    const existingStream = localStreamRef.current;
    if (
      existingStream &&
      existingStream.getTracks().some((track) => track.readyState === 'live')
    ) {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = existingStream;
        await localVideoRef.current.play().catch(() => undefined);
      }
      setMediaReady(true);
      return existingStream;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new Error('Camera or microphone permission was denied. Allow both in browser site settings.');
      }
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new Error('No camera or microphone was found on this device.');
      }
      if (err instanceof DOMException && err.name === 'NotReadableError') {
        throw new Error('Camera or microphone is being used by another application. Close that application and retry.');
      }
      throw err;
    }

    localStreamRef.current = stream;

    // Set media state from the actual tracks.
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    videoTracks.forEach((track) => {
      track.enabled = true;
    });
    audioTracks.forEach((track) => {
      track.enabled = true;
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch((playError) => {
        console.warn('Local preview autoplay was blocked:', playError);
      });
    }

    setCameraOn(videoTracks.length > 0);
    setMicOn(audioTracks.length > 0);
    setMediaReady(videoTracks.length > 0 || audioTracks.length > 0);

    if (videoTracks.length === 0 && audioTracks.length === 0) {
      throw new Error('No active camera or microphone tracks were created.');
    }

    return stream;
  };

  const createPeer = useCallback(() => {
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];

      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        void remoteVideoRef.current.play().catch(console.error);
        setConnected(true);
        setMessage('Video consultation connected.');
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && !callEndedRef.current) {
        void sendSignal('ice-candidate', event.candidate.toJSON()).catch((err) => {
          console.error('ICE signal error:', err);
          setError('Unable to exchange connection information.');
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setConnected(true);
        setMessage('Video consultation connected.');
      } else if (
        peer.connectionState === 'failed' ||
        peer.connectionState === 'disconnected'
      ) {
        setConnected(false);
        setMessage('Connection interrupted. Check your network.');
      } else if (peer.connectionState === 'closed') {
        setConnected(false);
      }
    };

    peerRef.current = peer;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    }

    return peer;
  }, [sendSignal]);

  const flushCandidates = useCallback(async (peer: RTCPeerConnection) => {
    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const startCall = async () => {
    if (callEndedRef.current || starting) return;

    setStarting(true);
    setError('');

    try {
      await startMedia();

      const peer = createPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal('offer', offer);

      setMessage('Calling the doctor. Waiting for them to join...');
    } catch (err) {
      console.error('Start call error:', err);
      cleanupMedia();
      setError(err instanceof Error ? err.message : 'Unable to start the call.');
    } finally {
      setStarting(false);
    }
  };

  const answerCall = async () => {
    if (callEndedRef.current || starting) return;

    setStarting(true);
    setError('');

    try {
      const offer = incomingOfferRef.current;
      if (!offer) throw new Error('Incoming call offer is unavailable.');

      await startMedia();

      const peer = createPeer();
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushCandidates(peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal('answer', answer);

      setIncomingOffer(false);
      setMessage('Answer sent. Connecting to the patient...');
    } catch (err) {
      console.error('Answer call error:', err);
      cleanupMedia();
      setError(err instanceof Error ? err.message : 'Unable to answer the call.');
    } finally {
      setStarting(false);
    }
  };

  const handleSignal = useCallback(
    async (signal: SignalRow) => {
      if (
        signal.recipient_id !== userIdRef.current ||
        handledSignalsRef.current.has(signal.id)
      ) return;

      handledSignalsRef.current.add(signal.id);

      try {
        if (signal.message_type === 'offer') {
          if (callEndedRef.current) return;
          incomingOfferRef.current = signal.payload;
          setIncomingOffer(true);
          setMessage('Incoming video consultation. You can answer now.');
        }

        if (signal.message_type === 'answer') {
          const peer = peerRef.current;
          if (!peer || callEndedRef.current) return;

          await peer.setRemoteDescription(
            new RTCSessionDescription(signal.payload),
          );
          await flushCandidates(peer);
          setMessage('Doctor answered. Connecting...');
        }

        if (signal.message_type === 'ice-candidate') {
          if (callEndedRef.current) return;

          const candidate = signal.payload as RTCIceCandidateInit;
          const peer = peerRef.current;

          if (peer?.remoteDescription) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }

        if (signal.message_type === 'call-ended') {
          callEndedRef.current = true;
          setCallEnded(true);
          setMessage('The other participant ended the call.');
          cleanupMedia();
        }
      } catch (err) {
        console.error('Signal handling error:', err);
        setError('Unable to process the call connection.');
      }
    },
    [cleanupMedia, flushCandidates],
  );

  const endCall = async () => {
    if (callEndedRef.current) return;

    callEndedRef.current = true;
    setCallEnded(true);
    setMessage('Ending consultation...');
    setError('');

    try {
      await sendSignal('call-ended');
    } catch (err) {
      console.error('Call end signal error:', err);
      setError('Call ended locally, but the other participant could not be notified.');
    } finally {
      cleanupMedia();
      setCallEnded(true);
      setMessage('You have left the consultation.');
    }
  };

  const returnToConsultations = () => {
    cleanupMedia();
    onClose();
  };

  // Toggle all available video tracks.
  const toggleCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) {
      setError('No active camera track. Start the call first.');
      return;
    }

    const nextState = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = nextState;
    });

    setCameraOn(nextState);
    setError('');
  };

  // Toggle all available audio tracks.
  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) {
      setError('No active microphone track. Start the call first.');
      return;
    }

    const nextState = !tracks.every((track) => track.enabled);
    tracks.forEach((track) => {
      track.enabled = nextState;
    });

    setMicOn(nextState);
    setError('');
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) throw new Error('Please sign in again.');

        userIdRef.current = auth.user.id;

        const { data: consultation, error: consultationError } = await supabase
          .from('consultations')
          .select('id, patient_id, doctor_id, consultation_mode, status')
          .eq('id', consultationId)
          .single();

        if (consultationError) throw consultationError;

        const info = consultation as ConsultationInfo;

        if (info.consultation_mode !== 'Online') {
          throw new Error('This consultation is not an online appointment.');
        }

        if (!['scheduled', 'waiting', 'checked_in', 'in_progress'].includes(info.status)) {
          throw new Error('This consultation is not currently available.');
        }

        const { data: doctor, error: doctorError } = await supabase
          .from('doctors')
          .select('user_id')
          .eq('id', info.doctor_id)
          .single();

        if (doctorError) throw doctorError;

        if (auth.user.id !== info.patient_id && auth.user.id !== doctor.user_id) {
          throw new Error('You are not a participant in this consultation.');
        }

        const doctorSide = auth.user.id === doctor.user_id;
        setIsDoctor(doctorSide);

        recipientIdRef.current = doctorSide ? info.patient_id : doctor.user_id;

        const callChannel = supabase.channel(
          `ydhya-call-${consultationId}-${auth.user.id}-${crypto.randomUUID()}`,
        );

        callChannel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'consultation_signals',
            filter: `consultation_id=eq.${consultationId}`,
          },
          (payload) => {
            void handleSignal(payload.new as SignalRow);
          },
        );

        channel = callChannel;

        channel.subscribe((status) => {
          if (!mounted) return;

          if (status === 'SUBSCRIBED') {
            setMessage(
              doctorSide
                ? 'Ready. Waiting for the patient to start the call...'
                : 'Ready. Start the call when your doctor is available.',
            );
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setError('Realtime connection failed. Please reopen the consultation.');
          }
        });

        if (mounted) setLoading(false);
      } catch (err) {
        console.error('Video consultation setup error:', err);

        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to open consultation.');
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
      cleanupMedia();
    };
  }, [consultationId, handleSignal, cleanupMedia]);

  return (
    <div className="yd-video-page">
      <header className="yd-video-header">
        <div className="yd-video-brand">
          <span className="yd-video-brand-icon"><Video size={21} /></span>
          <div>
            <strong>Bavyesh's YDHYA</strong>
            <small>Online Consultation</small>
          </div>
        </div>

        <div className="yd-video-security">
          <ShieldCheck size={17} />
          Private consultation
        </div>

        <button className="yd-video-close" onClick={returnToConsultations} type="button">
          Close
        </button>
      </header>

      <main className="yd-video-main">
        <div className="yd-video-title">
          <span>{isDoctor ? 'DOCTOR WORKSPACE' : 'PATIENT WORKSPACE'}</span>
          <h1>Video Consultation</h1>
          <p>{message}</p>
        </div>

        {error && (
          <div className="yd-video-error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="yd-video-loading">
            <LoaderCircle className="yd-video-spin" size={34} />
            <p>Preparing your consultation...</p>
          </div>
        ) : (
          <>
            <div className="yd-video-stage">
              <div className="yd-video-remote">
                <video ref={remoteVideoRef} autoPlay playsInline />

                {!connected && (
                  <div className="yd-video-placeholder">
                    <Video size={42} />
                    <strong>Waiting for participant</strong>
                    <span>The other participant will appear here.</span>
                  </div>
                )}
              </div>

              <div className="yd-video-local">
                <video ref={localVideoRef} autoPlay muted playsInline />

                {!mediaReady && (
                  <div className="yd-video-local-placeholder">
                    <Camera size={24} />
                    <span>Your camera preview</span>
                  </div>
                )}
              </div>
            </div>

            <div className="yd-video-controls">
              <button
                type="button"
                onClick={toggleMic}
                disabled={!mediaReady || callEnded}
                aria-label={micOn ? 'Mute microphone' : 'Enable microphone'}
              >
                {micOn ? <Mic /> : <MicOff />}
                <span>{micOn ? 'Mute' : 'Unmute'}</span>
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                disabled={!mediaReady || callEnded}
                aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              >
                {cameraOn ? <Video /> : <VideoOff />}
                <span>{cameraOn ? 'Camera off' : 'Camera on'}</span>
              </button>

              {!isDoctor && !connected && !callEnded && (
                <button
                  type="button"
                  className="yd-video-start"
                  onClick={() => void startCall()}
                  disabled={starting}
                >
                  {starting ? <LoaderCircle className="yd-video-spin" /> : <Video />}
                  {starting ? 'Starting...' : 'Start call'}
                </button>
              )}

              {isDoctor && incomingOffer && !connected && !callEnded && (
                <button
                  type="button"
                  className="yd-video-start"
                  onClick={() => void answerCall()}
                  disabled={starting}
                >
                  {starting ? <LoaderCircle className="yd-video-spin" /> : <Video />}
                  {starting ? 'Joining...' : 'Answer call'}
                </button>
              )}

              {!callEnded ? (
                <button
                  type="button"
                  className="yd-video-end"
                  onClick={() => void endCall()}
                  disabled={starting}
                >
                  <PhoneOff />
                  <span>End call</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="yd-video-start"
                  onClick={returnToConsultations}
                >
                  <span>Return to consultations</span>
                </button>
              )}
            </div>

            <p className="yd-video-media-status">
              {mediaReady
                ? 'Camera and microphone are ready.'
                : 'Start or answer the call to enable camera and microphone controls.'}
            </p>
          </>
        )}
      </main>

      <footer className="yd-video-footer">
        YDHYA online consultation · Do not share your meeting link with others.
      </footer>
    </div>
  );
}
