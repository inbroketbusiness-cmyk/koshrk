'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FaceCapture from '@/components/FaceCapture';
import HeartField from '@/components/HeartField';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Public relay so calls still connect across strict mobile-data / office
  // NATs where plain STUN fails (this is what was causing calls to not go
  // through before). It's a free demo relay — fine for two people, but if
  // it ever gets flaky, swap in your own TURN server here.
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

// 10 of your own gallery photos, used as couple-wallpaper choices. Picking
// one calls /api/settings/wallpaper, so both of you always see the same
// wallpaper — not just saved to one phone's browser.
const WALLPAPERS = [
  { id: 'w1', file: '/img/gallery/g06_couple_mall.jpg', label: 'Mall Day' },
  { id: 'w2', file: '/img/gallery/g07_couple_road.jpg', label: 'Road Trip' },
  { id: 'w3', file: '/img/gallery/g12_couple_stairs.jpg', label: 'Stairway' },
  { id: 'w4', file: '/img/gallery/g15_couple_temple1.jpg', label: 'Temple' },
  { id: 'w5', file: '/img/gallery/g16_couple_tree.jpg', label: 'Under the Tree' },
  { id: 'w6', file: '/img/gallery/g18_couple_temple2.jpg', label: 'Temple II' },
  { id: 'w7', file: '/img/gallery/g01_diya.jpg', label: 'Diya Glow' },
  { id: 'w8', file: '/img/gallery/g09_saree.jpg', label: 'Saree Day' },
  { id: 'w9', file: '/img/gallery/g11_cake.jpg', label: 'Cake Time' },
  { id: 'w10', file: '/img/gallery/g14_temple_bag.jpg', label: 'Together' },
];
function wallpaperFile(id) {
  return WALLPAPERS.find((w) => w.id === id)?.file || null;
}

const REEL_URL_RE = /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+\/?/i;

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatLastSeen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `Last seen today, ${time}`;
    const date = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `Last seen ${date}, ${time}`;
  } catch {
    return '';
  }
}

function formatDuration(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

async function sendSignal(type, payload) {
  try {
    await fetch('/api/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    /* best-effort — next poll / user retry will recover */
  }
}

export default function ChatPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const lastIdRef = useRef(null);
  const sendLockRef = useRef(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [avatarZoom, setAvatarZoom] = useState(null); // null | 'me' | 'partner'
  const [lightboxImg, setLightboxImg] = useState(null);

  // ---- Edit / delete ------------------------------------------------------
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  // ---- Gallery photos (used by the Gallery drawer, avatar picker, etc.) ----
  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      if (data.ok) setGalleryImages(data.images);
    } catch {
      /* next poll retries */
    }
  }, []);

  useEffect(() => {
    fetchGallery();
    const id = setInterval(fetchGallery, 10000);
    return () => clearInterval(id);
  }, [fetchGallery]);

  // ---- Wallpaper (shared between both partners via the server) ------------
  const [wallpaper, setWallpaperState] = useState(null);
  const fetchWallpaper = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/wallpaper');
      const data = await res.json();
      if (data.ok) setWallpaperState(data.wallpaper);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    fetchWallpaper();
    const id = setInterval(fetchWallpaper, 6000);
    return () => clearInterval(id);
  }, [fetchWallpaper]);

  async function setWallpaper(id) {
    setWallpaperState(id); // optimistic, feels instant
    try {
      await fetch('/api/settings/wallpaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallpaper: id }),
      });
    } catch {
      /* will resync on next poll */
    }
  }
  const wallpaperUrl = wallpaper ? wallpaperFile(wallpaper) : null;

  // ---- Quiz -----------------------------------------------------------------
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizTab, setQuizTab] = useState('today'); // 'today' | 'make'
  const [quizzes, setQuizzes] = useState([]);
  const blankQuestion = () => ({ question: '', options: ['', '', '', ''], correctIndex: 0 });
  const [quizTitle, setQuizTitle] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([blankQuestion()]);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizError, setQuizError] = useState('');

  // Solving flow
  const [activeQuiz, setActiveQuiz] = useState(null); // { _id, title, questions:[{_id,question,options}] }
  const [activeQuizInfo, setActiveQuizInfo] = useState(null); // alreadyAttempted / myScore
  const [solveIndex, setSolveIndex] = useState(0);
  const [solveAnswers, setSolveAnswers] = useState([]);
  const [solveResult, setSolveResult] = useState(null); // { score, total, results }

  async function fetchQuizzes() {
    const res = await fetch('/api/quiz');
    const data = await res.json();
    if (data.ok) setQuizzes(data.quizzes);
  }

  async function openQuizDrawer() {
    setMoreMenuOpen(false);
    setQuizOpen(true);
    setActiveQuiz(null);
    setSolveResult(null);
    await fetchQuizzes();
  }

  function addQuizQuestion() {
    setQuizQuestions((qs) => [...qs, blankQuestion()]);
  }
  function removeQuizQuestion(idx) {
    setQuizQuestions((qs) => (qs.length > 1 ? qs.filter((_, i) => i !== idx) : qs));
  }
  function updateQuizQuestion(idx, field, value) {
    setQuizQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  }
  function updateQuizOption(idx, optIdx, value) {
    setQuizQuestions((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, options: q.options.map((o, oi) => (oi === optIdx ? value : o)) } : q))
    );
  }

  async function submitQuiz(e) {
    e.preventDefault();
    setQuizError('');
    setQuizBusy(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: quizTitle, questions: quizQuestions }),
      });
      const data = await res.json();
      if (!data.ok) {
        setQuizError(data.error || 'Could not create the quiz.');
        return;
      }
      setQuizTitle('');
      setQuizQuestions([blankQuestion()]);
      await fetchQuizzes();
      setQuizTab('today');
    } finally {
      setQuizBusy(false);
    }
  }

  async function startSolving(quiz) {
    const res = await fetch(`/api/quiz/${quiz._id}`);
    const data = await res.json();
    if (!data.ok) return;
    setActiveQuiz(data.quiz);
    setActiveQuizInfo({ alreadyAttempted: data.quiz.alreadyAttempted, myScore: data.quiz.myScore });
    setSolveIndex(0);
    setSolveAnswers(new Array(data.quiz.questions.length).fill(null));
    setSolveResult(null);
  }

  function pickAnswer(optIdx) {
    setSolveAnswers((prev) => prev.map((a, i) => (i === solveIndex ? optIdx : a)));
  }

  function nextQuestion() {
    if (solveIndex < activeQuiz.questions.length - 1) {
      setSolveIndex((i) => i + 1);
    } else {
      submitAttempt();
    }
  }

  async function submitAttempt() {
    const res = await fetch(`/api/quiz/${activeQuiz._id}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: solveAnswers }),
    });
    const data = await res.json();
    if (data.ok) {
      setSolveResult(data);
      fetchQuizzes();
    } else {
      setQuizError(data.error || 'Could not submit your answers.');
    }
  }

  function closeQuizSolve() {
    setActiveQuiz(null);
    setActiveQuizInfo(null);
    setSolveResult(null);
  }

  // ---- Voice notes ------------------------------------------------------------
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const [voiceNotes, setVoiceNotes] = useState([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const seconds = recordSeconds;
        setRecordSeconds(0);
        if (blob.size > 500) await uploadVoiceNote(blob, seconds);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert('Mic access nahi mila — permission check karo.');
    }
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  async function uploadVoiceNote(blob, seconds) {
    const form = new FormData();
    form.append('audio', blob, 'voice.webm');
    form.append('seconds', String(seconds));
    const res = await fetch('/api/upload-voice', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      setMessages((prev) => [...prev, data.message]);
      lastIdRef.current = data.message._id;
    }
  }

  async function fetchVoiceNotes() {
    const res = await fetch('/api/voice-notes');
    const data = await res.json();
    if (data.ok) setVoiceNotes(data.notes);
  }

  // ---- Reel share ---------------------------------------------------------------
  const [reelModalOpen, setReelModalOpen] = useState(false);
  const [reelUrlInput, setReelUrlInput] = useState('');
  const [reelError, setReelError] = useState('');

  async function sendReel(e) {
    e.preventDefault();
    setReelError('');
    if (!REEL_URL_RE.test(reelUrlInput.trim())) {
      setReelError('Instagram Reel/post ka link paste karo (https://instagram.com/reel/...).');
      return;
    }
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reelUrl: reelUrlInput.trim() }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessages((prev) => [...prev, data.message]);
      lastIdRef.current = data.message._id;
      setReelUrlInput('');
      setReelModalOpen(false);
    } else {
      setReelError(data.error || 'Link bhejne mein dikkat hui.');
    }
  }

  // ---- Real camera capture (take a photo, not just pick a file) --------------
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [cameraFacing, setCameraFacing] = useState('user');

  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
    } catch {
      alert('Camera access nahi mila.');
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  }

  async function flipCameraModal() {
    const next = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(next);
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
    } catch {
      /* keep old stream state if it fails */
    }
  }

  async function capturePhoto() {
    const video = cameraVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      closeCamera();
      await uploadImageBlob(blob);
    }, 'image/jpeg', 0.92);
  }

  async function uploadImageBlob(blob) {
    const form = new FormData();
    form.append('image', blob, 'photo.jpg');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      setMessages((prev) => [...prev, data.message]);
      lastIdRef.current = data.message._id;
      fetchGallery();
    }
  }

  // ---- Settings: password + avatar --------------------------------------------
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const avatarPickRef = useRef(null);
  const [avatarMsg, setAvatarMsg] = useState('');

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg('');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin: pwCurrent, newPin: pwNew }),
    });
    const data = await res.json();
    setPwMsg(data.ok ? 'PIN updated ✔' : data.error || 'Could not update PIN.');
    if (data.ok) {
      setPwCurrent('');
      setPwNew('');
    }
  }

  async function uploadNewAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    const res = await fetch('/api/auth/avatar', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      setMe((m) => ({ ...m, avatarPath: data.avatarPath }));
      setAvatarMsg('Profile photo updated ✔');
    } else {
      setAvatarMsg(data.error || 'Could not update photo.');
    }
    e.target.value = '';
  }

  async function pickAvatarFromGallery(imagePath) {
    const res = await fetch('/api/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath }),
    });
    const data = await res.json();
    if (data.ok) {
      setMe((m) => ({ ...m, avatarPath: data.avatarPath }));
      setAvatarMsg('Profile photo updated ✔');
    } else {
      setAvatarMsg(data.error || 'Could not update photo.');
    }
  }

  // ---- WebRTC calling -------------------------------------------------------
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const incomingOfferRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStateRef = useRef('idle');

  const [callState, setCallState] = useState('idle'); // idle | outgoing | incoming | connected
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callError, setCallError] = useState('');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState('user');

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const stopTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    callTimerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
  }, [stopTimer]);

  const cleanupCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      try { pcRef.current.close(); } catch { /* already closed */ }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    pendingCandidatesRef.current = [];
    incomingOfferRef.current = null;
    stopTimer();
    setCallState('idle');
    setMuted(false);
    setCameraOff(false);
    setCallSeconds(0);
    setFacingMode('user');
  }, [stopTimer]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal('candidate', e.candidate.toJSON());
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startTimer();
      }
      if (['failed', 'closed'].includes(pc.connectionState)) {
        cleanupCall();
      }
    };
    pcRef.current = pc;
    return pc;
  }, [cleanupCall, startTimer]);

  async function getMedia(type) {
    const constraints = type === 'video'
      ? { video: { facingMode: 'user' }, audio: true }
      : { video: false, audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (type === 'video' && localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  async function startCall(type) {
    if (!partner) {
      alert('Partner abhi connect nahi hai — unke join karne ka wait karo.');
      return;
    }
    if (callStateRef.current !== 'idle') return;
    setCallError('');
    setCallType(type);
    setCallState('outgoing');
    setCallSeconds(0);
    try {
      const stream = await getMedia(type);
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', { sdp: offer, callType: type });
    } catch (err) {
      setCallError(err.message || 'Camera/mic access nahi mila.');
      cleanupCall();
    }
  }

  async function acceptCall() {
    const offer = incomingOfferRef.current;
    if (!offer) return;
    setCallError('');
    try {
      const type = offer.callType || 'video';
      setCallType(type);
      const stream = await getMedia(type);
      const pc = createPeerConnection();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      for (const c of pendingCandidatesRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore stale candidate */ }
      }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', { sdp: answer });
      setCallState('connected');
      startTimer();
    } catch (err) {
      setCallError(err.message || 'Call accept nahi ho paayi.');
      declineCall();
    }
  }

  function declineCall() {
    sendSignal('hangup', {});
    cleanupCall();
  }

  function endCall() {
    sendSignal('hangup', {});
    cleanupCall();
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = cameraOff; });
    setCameraOff((c) => !c);
  }

  // Best-effort loudspeaker toggle — full device output routing (setSinkId)
  // isn't supported everywhere, but this switches it wherever the browser
  // allows and gives clear on/off feedback either way.
  async function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    const el = remoteAudioRef.current;
    if (el && typeof el.setSinkId === 'function') {
      try {
        await el.setSinkId(next ? 'default' : 'communications');
      } catch {
        /* device switching not supported on this browser — UI state still toggles */
      }
    }
  }

  // Front/back camera switch mid-call.
  async function switchCallCamera() {
    if (callType !== 'video' || !localStreamRef.current) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing }, audio: false });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      const audioTracks = localStreamRef.current.getAudioTracks();
      const combined = new MediaStream([newTrack, ...audioTracks]);
      localStreamRef.current = combined;
      if (localVideoRef.current) localVideoRef.current.srcObject = combined;
      setFacingMode(nextFacing);
    } catch {
      setCallError('Camera switch nahi ho paaya.');
    }
  }

  const pollCallSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/call');
      const data = await res.json();
      if (!data.ok || !data.signals?.length) return;
      for (const sig of data.signals) {
        if (sig.type === 'offer') {
          if (pcRef.current || callStateRef.current !== 'idle') {
            sendSignal('hangup', {});
            continue;
          }
          incomingOfferRef.current = { sdp: sig.payload.sdp, callType: sig.payload.callType || 'video' };
          setCallType(sig.payload.callType || 'video');
          setCallState('incoming');
        } else if (sig.type === 'answer') {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
            for (const c of pendingCandidatesRef.current) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
            }
            pendingCandidatesRef.current = [];
          }
        } else if (sig.type === 'candidate') {
          if (pcRef.current && pcRef.current.remoteDescription) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.payload)); } catch { /* ignore */ }
          } else {
            pendingCandidatesRef.current.push(sig.payload);
          }
        } else if (sig.type === 'hangup') {
          cleanupCall();
        }
      }
    } catch {
      /* network hiccup — next tick retries */
    }
  }, [cleanupCall]);

  useEffect(() => {
    const id = setInterval(pollCallSignals, 1500);
    return () => clearInterval(id);
  }, [pollCallSignals]);

  useEffect(() => cleanupCall, [cleanupCall]); // stop camera/mic if the page unmounts mid-call

  // ---- Initial load: who am I + who's my partner + last 50 messages. ------
  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        router.push('/');
        return;
      }
      const meData = await meRes.json();
      setMe(meData.me);
      setPartner(meData.partner);

      const msgRes = await fetch('/api/messages');
      const msgData = await msgRes.json();
      if (msgData.ok) {
        setMessages(msgData.messages);
        if (msgData.messages.length) {
          lastIdRef.current = msgData.messages[msgData.messages.length - 1]._id;
        }
      }
    })();
  }, [router]);

  const poll = useCallback(async () => {
    const meRes = await fetch('/api/auth/me');
    if (meRes.status === 401) {
      router.push('/');
      return;
    }
    const meData = await meRes.json();
    setPartner(meData.partner);

    const url = lastIdRef.current ? `/api/messages?after=${lastIdRef.current}` : '/api/messages';
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok && data.messages.length) {
      setMessages((prev) => [...prev, ...data.messages]);
      lastIdRef.current = data.messages[data.messages.length - 1]._id;
    }
  }, [router]);

  // 2s polling, same cadence as the PHP/vanilla-JS version.
  useEffect(() => {
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendText(e) {
    e.preventDefault();
    // Synchronous guard: some mobile keyboards fire the Enter/"Go" key twice
    // in the same tick (once via our onKeyDown handler, once via the
    // textarea's own submit behaviour). A ref check happens instantly,
    // before React re-renders, so the second call is blocked even though
    // both calls started with the same not-yet-cleared `text` value.
    if (sendLockRef.current) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    sendLockRef.current = true;
    setText('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...prev, data.message]);
        lastIdRef.current = data.message._id;
      }
    } finally {
      sendLockRef.current = false;
    }
  }

  async function sendImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImageBlob(file);
    e.target.value = '';
  }

  async function saveEdit(id) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessages((prev) => prev.map((m) => (m._id === id ? data.message : m)));
    }
    setEditingId(null);
    setEditText('');
  }

  async function deleteMessage(id) {
    if (!confirm('Ye message delete karna hai?')) return;
    const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      setMessages((prev) => prev.map((m) => (m._id === id ? data.message : m)));
    }
    setOpenMenuId(null);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  async function openGallery() {
    setMoreMenuOpen(false);
    setGalleryOpen(true);
    const res = await fetch('/api/gallery');
    const data = await res.json();
    if (data.ok) setGalleryImages(data.images);
  }

  function openSettings() {
    setMoreMenuOpen(false);
    setSettingsOpen(true);
    fetchVoiceNotes();
  }

  async function saveFace(descriptor) {
    const res = await fetch('/api/auth/face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor }),
    });
    const data = await res.json();
    setFaceMsg(data.ok ? 'Face ID saved ✔' : data.error || 'Could not save Face ID.');
  }

  async function downloadImage(url) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = 'ritikomal-memory.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, '_blank');
    }
  }

  if (!me) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ color: 'var(--ink-soft)' }}>
        Loading…
      </div>
    );
  }

  const showCallOverlay = callState !== 'idle';
  const showBigAvatar = callType === 'audio' || callState !== 'connected';
  const unsolvedCount = quizzes.filter((q) => !q.myScore).length;

  return (
    <div
      className="app-shell flex flex-col"
      style={{ background: 'var(--bg-black)' }}
    >
      <HeartField />

      {/* ================= TOP BAR ================= */}
      <header className="app-header glass flex items-center px-3 sm:px-4 md:px-6 py-2 md:py-2.5 z-30 gap-3 shrink-0">
        <span className="app-header-title font-display text-lg sm:text-xl md:text-2xl whitespace-nowrap shrink-0" style={{ color: 'var(--ink)' }}>
          RITIKOMAL <span style={{ color: 'var(--red-deep)' }}>LOVE</span>
        </span>

        {/* ---- Profile area (bigger, next to the heading) ---- */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="header-avatar-wrap" onClick={() => partner && setAvatarZoom('partner')}>
            <img src={partner?.avatarPath || '/img/avatar-default.jpg'} className="header-avatar" alt="" />
            <span className={`status-dot ${partner?.online ? 'online' : ''}`} />
          </div>
          <div className="leading-tight text-left min-w-0">
            <p className="header-name text-sm sm:text-base font-semibold truncate">{partner ? partner.username : 'Waiting for partner…'}</p>
            <p className="header-status text-[11px] sm:text-xs truncate" style={{ color: 'var(--ink-soft)' }}>
              {!partner ? '—' : partner.online ? 'online' : formatLastSeen(partner.lastSeen) || 'offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
          <button title="Voice call" onClick={() => startCall('audio')} className="topbar-btn btn-ghost rounded-full flex items-center justify-center shrink-0">📞</button>
          <button title="Video call" onClick={() => startCall('video')} className="topbar-btn btn-ghost rounded-full flex items-center justify-center shrink-0">🎥</button>
          <button
            title="More"
            onClick={() => setMoreMenuOpen((o) => !o)}
            className="topbar-btn btn-ghost rounded-full flex items-center justify-center shrink-0 has-badge"
          >
            ☰
            {unsolvedCount > 0 && <span className="quiz-badge">{unsolvedCount}</span>}
          </button>

          {moreMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
              <div className="glass more-menu">
                <button type="button" className="more-menu-item" onClick={openGallery}>🖼️ Gallery</button>
                <button type="button" className="more-menu-item" onClick={openQuizDrawer}>🧩 Quiz</button>
                <button type="button" className="more-menu-item" onClick={openSettings}>⚙️ Settings</button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ================= MAIN — full-width chat, no side rail ================= */}
      <main className="flex-1 min-h-0 relative overflow-hidden flex">
        <section className="flex-1 min-h-0 flex flex-col min-w-0">
          <div
            id="messageList"
            className="flex-1 min-h-0 overflow-y-auto px-3 md:px-8 py-5 space-y-3"
            style={
              wallpaperUrl
                ? {
                    backgroundImage: `linear-gradient(rgba(8,7,10,.74), rgba(8,7,10,.74)), url(${wallpaperUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundAttachment: 'local',
                  }
                : undefined
            }
            onClick={() => setOpenMenuId(null)}
          >
            {messages.map((m) => {
              const mine = String(m.senderId) === String(me.id);
              const isEditingThis = editingId === m._id;
              return (
                <div
                  key={m._id}
                  className={`bubble-row ${mine ? 'mine' : ''} ${openMenuId === m._id ? 'menu-open' : ''}`}
                >
                  {isEditingThis ? (
                    <div className="bubble-edit-box" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        rows={1}
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit(m._id);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditText('');
                          }
                        }}
                      />
                      <button type="button" onClick={() => saveEdit(m._id)} className="bubble-action-btn" title="Save">✔</button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditText(''); }}
                        className="bubble-action-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`bubble ${mine ? 'mine' : 'theirs'} ${m.isDeleted ? 'deleted' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (mine && !m.isDeleted) setOpenMenuId((id) => (id === m._id ? null : m._id));
                        }}
                      >
                        {m.isDeleted ? (
                          <span>🚫 Ye message delete kar diya gaya hai</span>
                        ) : m.isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.imagePath} alt="shared" className="chat-photo" onClick={(e) => { e.stopPropagation(); setLightboxImg(m.imagePath); }} />
                        ) : m.isVoice ? (
                          <div className="voice-bubble">
                            <audio controls src={m.voicePath} />
                            {m.voiceSeconds > 0 && <span className="text-[10px] opacity-70">{formatDuration(m.voiceSeconds)}</span>}
                          </div>
                        ) : m.isReel ? (
                          <div className="reel-card">
                            <div className="reel-card-icon">🎬</div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold">Instagram Reel</p>
                              <a href={m.reelUrl} target="_blank" rel="noopener noreferrer" className="text-xs">Open Reel ↗</a>
                            </div>
                          </div>
                        ) : (
                          <span>{m.text}</span>
                        )}
                        <div className="meta">
                          <span>{formatTime(m.createdAt)}</span>
                          {m.isEdited && !m.isDeleted && <span>· edited</span>}
                        </div>
                      </div>

                      {mine && !m.isDeleted && (
                        <div className="bubble-actions">
                          {!m.isImage && !m.isVoice && !m.isReel && (
                            <button
                              type="button"
                              className="bubble-action-btn"
                              title="Edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(m._id);
                                setEditText(m.text || '');
                                setOpenMenuId(null);
                              }}
                            >
                              ✏️
                            </button>
                          )}
                          <button
                            type="button"
                            className="bubble-action-btn danger"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMessage(m._id);
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={sendText}
            id="composer"
            className="glass mx-2 sm:mx-3 md:mx-8 mb-2 sm:mb-3 rounded-2xl p-2 sm:p-2.5 flex items-end gap-1.5 sm:gap-2 relative shrink-0"
          >
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAttachMenuOpen((o) => !o)}
                title="Photo, camera or reel"
                className="w-10 h-10 rounded-full btn-ghost flex items-center justify-center"
              >
                ⋯
              </button>
              {attachMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAttachMenuOpen(false)} />
                  <div className="glass attach-menu">
                    <button
                      type="button"
                      className="more-menu-item"
                      onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                    >
                      📷 Photo from gallery
                    </button>
                    <button
                      type="button"
                      className="more-menu-item"
                      onClick={() => { setAttachMenuOpen(false); openCamera(); }}
                    >
                      🤳 Take a photo
                    </button>
                    <button
                      type="button"
                      className="more-menu-item"
                      onClick={() => { setAttachMenuOpen(false); setReelModalOpen(true); }}
                    >
                      🎬 Share a Reel
                    </button>
                  </div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={sendImage} />

            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendText(e);
                }
              }}
              placeholder="Say something sweet…"
              className="flex-1 resize-none bg-transparent outline-none px-2 py-2 max-h-28 text-[15px]"
            />

            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              title={recording ? 'Stop & send' : 'Record a voice note'}
              className={`w-10 h-10 rounded-full btn-ghost mic-btn flex items-center justify-center shrink-0 ${recording ? 'recording' : ''}`}
            >
              {recording ? `⏹ ${formatDuration(recordSeconds)}` : '🎙️'}
            </button>

            <button type="submit" title="Send" className="btn-love w-10 h-10 rounded-full flex items-center justify-center shrink-0">➤</button>
          </form>
        </section>

        {/* ================= GALLERY DRAWER ================= */}
        <aside className={`glass absolute top-0 right-0 h-full w-full sm:w-96 z-40 flex flex-col ${galleryOpen ? 'open' : ''}`} style={{ transform: galleryOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .35s cubic-bezier(.4,0,.2,1)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/25">
            <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Our Memories Gallery</h2>
            <button onClick={() => setGalleryOpen(false)} className="w-8 h-8 rounded-full btn-ghost flex items-center justify-center">✕</button>
          </div>
          <p className="px-5 pt-3 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            Ye photos yahan se kabhi delete nahi hoti — chat se delete karo tab bhi yahan rehti hain. Tap to view + download.
          </p>
          <div className="gallery-grid flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-2">
            {galleryImages.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img._id} src={img.imagePath} alt="" onClick={() => setLightboxImg(img.imagePath)} />
            ))}
            {galleryImages.length === 0 && (
              <p className="col-span-3 text-xs text-center mt-6" style={{ color: 'var(--ink-soft)' }}>
                No photos shared yet.
              </p>
            )}
          </div>
        </aside>

        {/* ================= QUIZ DRAWER ================= */}
        <aside id="quizDrawer" className={quizOpen ? 'open glass absolute top-0 right-0 h-full w-full sm:w-96 z-40 flex flex-col' : 'glass absolute top-0 right-0 h-full w-full sm:w-96 z-40 flex flex-col'}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/25">
            <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Quiz Time</h2>
            <button onClick={() => { setQuizOpen(false); closeQuizSolve(); }} className="w-8 h-8 rounded-full btn-ghost flex items-center justify-center">✕</button>
          </div>

          {!activeQuiz ? (
            <>
              <div className="flex gap-2 px-5 pt-4">
                <button type="button" className={`quiz-tab ${quizTab === 'today' ? 'active' : ''}`} onClick={() => setQuizTab('today')}>Today&apos;s Quiz</button>
                <button type="button" className={`quiz-tab ${quizTab === 'make' ? 'active' : ''}`} onClick={() => setQuizTab('make')}>Make Quiz</button>
              </div>

              <div className="quiz-panel flex-1 overflow-y-auto px-5 py-4">
                {quizTab === 'today' ? (
                  <div className="space-y-3">
                    {quizzes.length === 0 && (
                      <p className="text-xs text-center mt-6" style={{ color: 'var(--ink-soft)' }}>Koi quiz nahi bana abhi tak — Make Quiz se banao!</p>
                    )}
                    {quizzes.map((q) => (
                      <div key={q._id} className="quiz-card">
                        <div className="min-w-0">
                          <p className="quiz-card-title truncate">{q.title}</p>
                          <p className="quiz-card-sub">{q.questionCount} questions · by {q.creatorName}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {q.attempts.map((a, i) => (
                              <span key={i} className="score-pill">🏆 {a.username}: {a.score}/{a.total}</span>
                            ))}
                          </div>
                        </div>
                        {q.myScore ? (
                          <span className="score-pill shrink-0">You: {q.myScore.score}/{q.myScore.total}</span>
                        ) : (
                          <button type="button" onClick={() => startSolving(q)} className="btn-love rounded-full px-3 py-1.5 text-xs font-semibold shrink-0">Solve</button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <form onSubmit={submitQuiz} className="space-y-4">
                    <input
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="Quiz title (optional)"
                      className="w-full rounded-xl border border-red-900/30 bg-white/5 px-3 py-2 text-sm outline-none"
                    />
                    {quizQuestions.map((q, idx) => (
                      <div key={idx} className="quiz-question-block">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>Question {idx + 1}</p>
                          {quizQuestions.length > 1 && (
                            <button type="button" onClick={() => removeQuizQuestion(idx)} className="text-xs" style={{ color: 'var(--red-deep)' }}>Remove</button>
                          )}
                        </div>
                        <input
                          value={q.question}
                          onChange={(e) => updateQuizQuestion(idx, 'question', e.target.value)}
                          placeholder="Type your question"
                          required
                          className="w-full rounded-lg border border-red-900/30 bg-white/5 px-3 py-2 text-sm outline-none mb-1"
                        />
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="quiz-option-row">
                            <input
                              type="radio"
                              name={`correct-${idx}`}
                              checked={q.correctIndex === optIdx}
                              onChange={() => updateQuizQuestion(idx, 'correctIndex', optIdx)}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateQuizOption(idx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              required
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                    <button type="button" onClick={addQuizQuestion} className="btn-ghost w-full rounded-xl py-2 text-sm font-semibold">+ Add Question (optional)</button>
                    {quizError && <p className="text-xs text-center" style={{ color: 'var(--red-deep)' }}>{quizError}</p>}
                    <button type="submit" disabled={quizBusy} className="btn-love w-full rounded-xl py-2.5 text-sm font-semibold">
                      {quizBusy ? 'Sending…' : 'Send Quiz 💌'}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="quiz-panel flex-1 overflow-y-auto px-5 py-4">
              {activeQuizInfo?.alreadyAttempted && !solveResult ? (
                <div className="quiz-scorecard">
                  <p className="text-sm mb-1" style={{ color: 'var(--ink-soft)' }}>Aap ye quiz already solve kar chuke ho</p>
                  <p className="big-score">{activeQuizInfo.myScore.score}/{activeQuizInfo.myScore.total}</p>
                  <button type="button" onClick={closeQuizSolve} className="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold mt-3">Back</button>
                </div>
              ) : solveResult ? (
                <div className="space-y-3">
                  <div className="quiz-scorecard">
                    <p className="text-sm mb-1" style={{ color: 'var(--ink-soft)' }}>Your Score</p>
                    <p className="big-score">{solveResult.score}/{solveResult.total}</p>
                  </div>
                  {activeQuiz.questions.map((q, i) => (
                    <div key={q._id} className="quiz-question-block">
                      <p className="text-xs font-semibold mb-1.5">{i + 1}. {q.question}</p>
                      {q.options.map((opt, optIdx) => {
                        const isSelected = solveAnswers[i] === optIdx;
                        const isCorrect = solveResult.results[i].correctIndex === optIdx;
                        let cls = 'quiz-solve-option';
                        if (isCorrect) cls += ' correct';
                        else if (isSelected) cls += ' incorrect';
                        return <div key={optIdx} className={cls}>{opt}</div>;
                      })}
                    </div>
                  ))}
                  <button type="button" onClick={closeQuizSolve} className="btn-love w-full rounded-xl py-2.5 text-sm font-semibold">Done</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Question {solveIndex + 1} of {activeQuiz.questions.length}</p>
                  <div className="quiz-question-block">
                    <p className="text-sm font-semibold mb-2">{activeQuiz.questions[solveIndex].question}</p>
                    {activeQuiz.questions[solveIndex].options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`quiz-solve-option ${solveAnswers[solveIndex] === optIdx ? 'selected' : ''}`}
                        onClick={() => pickAnswer(optIdx)}
                      >
                        <input type="radio" readOnly checked={solveAnswers[solveIndex] === optIdx} />
                        {opt}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={solveAnswers[solveIndex] === null}
                    onClick={nextQuestion}
                    className="btn-love w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    {solveIndex < activeQuiz.questions.length - 1 ? 'Next →' : 'Submit Quiz ✔'}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ================= SETTINGS DRAWER ================= */}
        <aside className="glass absolute top-0 right-0 h-full w-full sm:w-96 z-40 flex flex-col" style={{ transform: settingsOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .35s cubic-bezier(.4,0,.2,1)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/25">
            <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Settings</h2>
            <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 rounded-full btn-ghost flex items-center justify-center">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3 mb-2">
              <img src={me.avatarPath} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: 'var(--red-deep)' }} alt="" />
              <div>
                <p className="font-semibold text-sm">{me.username}</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>This profile photo is yours ({me.username})</p>
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => avatarPickRef.current?.click()} className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold">Upload new photo</button>
              <input ref={avatarPickRef} type="file" accept="image/*" className="hidden" onChange={uploadNewAvatar} />
            </div>
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {galleryImages.slice(0, 12).map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img._id}
                    src={img.imagePath}
                    onClick={() => pickAvatarFromGallery(img.imagePath)}
                    className="w-full aspect-square object-cover rounded-lg cursor-pointer border border-red-900/25"
                    alt=""
                    title="Set as my profile photo"
                  />
                ))}
              </div>
            )}
            {avatarMsg && <p className="text-[11px] mb-5" style={{ color: 'var(--ink-soft)' }}>{avatarMsg}</p>}

            <p className="text-[11px] uppercase tracking-widest mb-2 mt-1" style={{ color: 'var(--ink-soft)' }}>Partner</p>
            <div className="flex items-center gap-3 mb-5">
              <img src={partner?.avatarPath || '/img/avatar-default.jpg'} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: 'var(--red-deep)' }} alt="" />
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>This one belongs to {partner?.username || 'your person'}</p>
            </div>

            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>Chat wallpaper — same for both of you</p>
            <div className="grid grid-cols-5 gap-2 mb-5">
              {WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  title={wp.label}
                  onClick={() => setWallpaper(wp.id)}
                  style={{ backgroundImage: `url(${wp.file})` }}
                  className={`wallpaper-swatch wallpaper-swatch-photo ${wallpaper === wp.id ? 'selected' : ''}`}
                />
              ))}
            </div>

            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>Voice notes (both of you)</p>
            <div className="mb-5 space-y-2 max-h-40 overflow-y-auto">
              {voiceNotes.length === 0 && <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>No voice notes yet.</p>}
              {voiceNotes.map((n) => (
                <div key={n._id} className="flex items-center gap-2">
                  <span className="text-[11px] w-14 shrink-0" style={{ color: 'var(--ink-soft)' }}>
                    {String(n.senderId) === String(me.id) ? me.username : partner?.username || 'Them'}
                  </span>
                  <audio controls src={n.voicePath} className="flex-1 h-8" />
                </div>
              ))}
            </div>

            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>Change password (PIN)</p>
            <form onSubmit={changePassword} className="space-y-2 mb-5">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Current 6-digit PIN"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                className="w-full rounded-lg border border-red-900/30 bg-white/5 px-3 py-2 text-sm outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="New 6-digit PIN"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                className="w-full rounded-lg border border-red-900/30 bg-white/5 px-3 py-2 text-sm outline-none"
              />
              <button type="submit" className="btn-ghost w-full rounded-xl py-2 text-sm font-semibold">Update PIN</button>
              {pwMsg && <p className="text-[11px] text-center" style={{ color: 'var(--ink-soft)' }}>{pwMsg}</p>}
            </form>

            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>Security</p>
            <div className="mb-6">
              <FaceCapture buttonLabel="Scan & save" onCapture={saveFace} />
              {faceMsg && <p className="text-center text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>{faceMsg}</p>}
            </div>

            <button type="button" onClick={logout} className="btn-danger w-full rounded-xl py-2.5 text-sm font-semibold">
              ⏻ Log out
            </button>
          </div>
        </aside>
      </main>

      {/* ================= AVATAR ZOOM OVERLAY ================= */}
      {avatarZoom && (
        <div className="avatar-zoom-overlay" onClick={() => setAvatarZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarZoom === 'me' ? me.avatarPath : (partner?.avatarPath || '/img/avatar-default.jpg')}
            className="avatar-zoom-img"
            alt=""
          />
        </div>
      )}

      {/* ================= LIGHTBOX (view + download) ================= */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxImg} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => downloadImage(lightboxImg)} className="btn-love rounded-full px-4 py-2 text-sm font-semibold">⬇ Download</button>
            <button type="button" onClick={() => setLightboxImg(null)} className="btn-ghost rounded-full px-4 py-2 text-sm font-semibold">Close</button>
          </div>
        </div>
      )}

      {/* ================= REAL CAMERA MODAL ================= */}
      {cameraOpen && (
        <div className="modal-overlay" onClick={closeCamera}>
          <div className="glass modal-card" onClick={(e) => e.stopPropagation()}>
            <video ref={cameraVideoRef} autoPlay playsInline muted className="camera-preview-video" />
            <button type="button" onClick={capturePhoto} className="camera-shutter-btn" title="Capture" />
            <div className="flex items-center justify-center gap-3 mt-3">
              <button type="button" onClick={flipCameraModal} className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold">🔄 Flip</button>
              <button type="button" onClick={closeCamera} className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= REEL SHARE MODAL ================= */}
      {reelModalOpen && (
        <div className="modal-overlay" onClick={() => setReelModalOpen(false)}>
          <form className="glass modal-card" onClick={(e) => e.stopPropagation()} onSubmit={sendReel}>
            <h3 className="font-display text-lg mb-1" style={{ color: 'var(--ink)' }}>Share an Instagram Reel</h3>
            <p className="text-[11px] mb-3" style={{ color: 'var(--ink-soft)' }}>
              Sirf link jaayega — Instagram yahan open nahi hoga, unke taraf click karne par unke Instagram app/browser mein khulega.
            </p>
            <input
              value={reelUrlInput}
              onChange={(e) => setReelUrlInput(e.target.value)}
              placeholder="https://instagram.com/reel/..."
              required
              className="w-full rounded-xl border border-red-900/30 bg-white/5 px-3 py-2 text-sm outline-none mb-2"
            />
            {reelError && <p className="text-xs mb-2" style={{ color: 'var(--red-deep)' }}>{reelError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-love flex-1 rounded-xl py-2.5 text-sm font-semibold">Send Reel</button>
              <button type="button" onClick={() => setReelModalOpen(false)} className="btn-ghost rounded-xl px-4 text-sm font-semibold">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ================= CALL OVERLAY ================= */}
      {showCallOverlay && (
        <div id="callOverlay" className="fixed inset-0 z-50 flex flex-col items-center justify-center">
          {callType === 'video' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="call-remote-video absolute inset-0 w-full h-full"
              style={{ display: callState === 'connected' ? 'block' : 'none' }}
            />
          )}
          {callType === 'video' && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="call-local-video"
              style={{ display: callState === 'outgoing' || callState === 'connected' ? 'block' : 'none' }}
            />
          )}
          <audio ref={remoteAudioRef} autoPlay />

          {showBigAvatar && (
            <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
              <img src={partner?.avatarPath || '/img/avatar-default.jpg'} className="call-avatar-ring" alt="" />
              <div>
                <p className="font-display text-2xl" style={{ color: 'var(--ink)' }}>{partner?.username || 'Your person'}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>
                  {callState === 'outgoing' && (callType === 'video' ? 'Video calling…' : 'Calling…')}
                  {callState === 'incoming' && (callType === 'video' ? 'Incoming video call…' : 'Incoming voice call…')}
                  {callState === 'connected' && <span className="call-timer">{formatDuration(callSeconds)}</span>}
                </p>
                {callError && <p className="text-xs mt-2" style={{ color: 'var(--red-deep)' }}>{callError}</p>}
              </div>
            </div>
          )}

          <div className="relative z-10 mt-10 flex items-center gap-5">
            {callState === 'incoming' ? (
              <>
                <button onClick={declineCall} className="call-control-btn end" title="Decline">✕</button>
                <button onClick={acceptCall} className="call-control-btn" style={{ background: '#35C46A' }} title="Accept">✓</button>
              </>
            ) : (
              <>
                <button onClick={toggleMute} className={`call-control-btn ${muted ? 'on' : 'off'}`} title={muted ? 'Unmute' : 'Mute'}>
                  {muted ? '🔇' : '🎙️'}
                </button>
                {callType === 'video' && (
                  <button onClick={toggleCamera} className={`call-control-btn ${cameraOff ? 'on' : 'off'}`} title={cameraOff ? 'Camera on' : 'Camera off'}>
                    {cameraOff ? '📷' : '🎥'}
                  </button>
                )}
                {callType === 'video' && callState === 'connected' && (
                  <button onClick={switchCallCamera} className="call-control-btn off" title="Switch front/back camera">🔄</button>
                )}
                <button onClick={toggleSpeaker} className={`call-control-btn ${speakerOn ? 'on' : 'off'}`} title={speakerOn ? 'Speaker on' : 'Speaker off'}>
                  {speakerOn ? '🔊' : '🔈'}
                </button>
                <button onClick={endCall} className="call-control-btn end" title="End call">📵</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
