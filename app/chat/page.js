'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FaceCapture from '@/components/FaceCapture';
import HeartField from '@/components/HeartField';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const WALLPAPERS = [
  { id: 'classic', label: 'Classic' },
  { id: 'stars', label: 'Stars' },
  { id: 'rose', label: 'Rose' },
  { id: 'midnight', label: 'Midnight' },
];

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');

  // ---- Edit / delete ------------------------------------------------------
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  // ---- Wallpaper ------------------------------------------------------------
  const [wallpaper, setWallpaperState] = useState('classic');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('rk-wallpaper') : null;
    if (saved) setWallpaperState(saved);
  }, []);
  function setWallpaper(id) {
    setWallpaperState(id);
    if (typeof window !== 'undefined') localStorage.setItem('rk-wallpaper', id);
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
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
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
  }

  async function sendImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      setMessages((prev) => [...prev, data.message]);
      lastIdRef.current = data.message._id;
    }
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
    setGalleryOpen(true);
    const res = await fetch('/api/gallery');
    const data = await res.json();
    if (data.ok) setGalleryImages(data.images);
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

  if (!me) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ color: 'var(--ink-soft)' }}>
        Loading…
      </div>
    );
  }

  const showCallOverlay = callState !== 'idle';
  const showBigAvatar = callType === 'audio' || callState !== 'connected';

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-black)' }}
    >
      <HeartField />

      {/* ================= TOP BAR ================= */}
      <header className="glass flex items-center justify-between px-3 sm:px-4 md:px-6 py-2.5 md:py-3 z-30 gap-2">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <span className="font-display text-lg sm:text-xl md:text-2xl whitespace-nowrap" style={{ color: 'var(--ink)' }}>
            RITIKOMAL <span style={{ color: 'var(--red-deep)' }}>LOVE</span>
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className={`status-dot shrink-0 ${partner?.online ? 'online' : ''}`} />
          <div className="leading-tight text-left min-w-0" style={{ maxWidth: '34vw' }}>
            <p className="text-sm font-semibold truncate">{partner ? partner.username : 'Waiting for partner…'}</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>
              {partner ? (partner.online ? 'online' : 'offline') : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button title="Voice call" onClick={() => startCall('audio')} className="topbar-btn btn-ghost rounded-full w-9 h-9 flex items-center justify-center shrink-0">📞</button>
          <button title="Video call" onClick={() => startCall('video')} className="topbar-btn btn-ghost rounded-full w-9 h-9 flex items-center justify-center shrink-0">🎥</button>
          <button title="Quiz Time (coming soon)" onClick={() => alert('The quiz feature is coming soon.')} className="topbar-btn btn-ghost rounded-full w-9 h-9 flex items-center justify-center shrink-0">🧩</button>
          <button title="Our Memories Gallery" onClick={openGallery} className="topbar-btn btn-ghost rounded-full w-9 h-9 flex items-center justify-center shrink-0">🖼️</button>
          <button title="Settings" onClick={() => setSettingsOpen(true)} className="topbar-btn btn-ghost rounded-full w-9 h-9 flex items-center justify-center shrink-0">⚙️</button>
          <button title="Logout" onClick={logout} className="topbar-btn btn-ghost rounded-full w-9 h-9 flex items-center justify-center shrink-0">⏻</button>
        </div>
      </header>

      {/* ================= HERO BANNER ================= */}
      <div className="hero-banner h-16 md:h-24 w-full" style={{ backgroundImage: "url('/img/banner.jpg')" }} />

      {/* ================= MAIN ================= */}
      <main className="flex-1 relative overflow-hidden flex">
        {/* ================= CONTACTS RAIL ================= */}
        <aside id="contactsRail" className="glass flex flex-col border-r border-red-900/20 overflow-y-auto">
          <div className="px-3 pt-3 pb-1 hidden md:block">
            <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--ink-soft)' }}>Chats</p>
          </div>
          <div className="p-2 space-y-1">
            <div className="contact-card active">
              <div className="contact-avatar-wrap">
                <img src={partner?.avatarPath || '/img/avatar-default.jpg'} className="contact-avatar" alt="" />
                <span className={`status-dot ${partner?.online ? 'online' : ''}`} />
              </div>
              <div className="min-w-0 hidden md:block">
                <p className="text-sm font-semibold truncate">{partner ? partner.username : 'Your person'}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>
                  {partner ? (partner.online ? 'online' : 'offline') : '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-auto p-3 hidden md:block">
            <p className="contact-offline-note">💌 Offline abhi bhi? Koi baat nahi — jo bhi likhoge, wo unhe milega jaise hi woh online aayenge.</p>
          </div>
        </aside>

        {/* Chat column */}
        <section className="flex-1 flex flex-col min-w-0">
          <div
            id="messageList"
            className={`flex-1 overflow-y-auto px-3 md:px-8 py-5 space-y-3 wp-${wallpaper}`}
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
                          <img src={m.imagePath} alt="shared" className="chat-photo" />
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
                          {!m.isImage && (
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
            className="glass mx-2 sm:mx-3 md:mx-8 mb-2 sm:mb-3 rounded-2xl p-2 sm:p-2.5 flex items-end gap-1.5 sm:gap-2 relative"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Send a photo"
              className="w-10 h-10 rounded-full btn-ghost flex items-center justify-center shrink-0"
            >
              📷
            </button>
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

            <button type="submit" title="Send" className="btn-love w-10 h-10 rounded-full flex items-center justify-center shrink-0">➤</button>
          </form>
        </section>

        {/* ================= GALLERY DRAWER ================= */}
        <aside className={`glass absolute top-0 right-0 h-full w-full sm:w-96 z-40 flex flex-col ${galleryOpen ? 'open' : ''}`} style={{ transform: galleryOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .35s cubic-bezier(.4,0,.2,1)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/25">
            <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Our Memories Gallery</h2>
            <button onClick={() => setGalleryOpen(false)} className="w-8 h-8 rounded-full btn-ghost flex items-center justify-center">✕</button>
          </div>
          <div className="gallery-grid flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-2">
            {galleryImages.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img._id} src={img.imagePath} alt="" />
            ))}
            {galleryImages.length === 0 && (
              <p className="col-span-3 text-xs text-center mt-6" style={{ color: 'var(--ink-soft)' }}>
                No photos shared yet.
              </p>
            )}
          </div>
        </aside>

        {/* ================= SETTINGS DRAWER ================= */}
        <aside className="glass absolute top-0 right-0 h-full w-full sm:w-96 z-40 flex flex-col" style={{ transform: settingsOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .35s cubic-bezier(.4,0,.2,1)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/25">
            <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Settings</h2>
            <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 rounded-full btn-ghost flex items-center justify-center">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3 mb-5">
              <img src={me.avatarPath} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: 'var(--red-deep)' }} alt="" />
              <div>
                <p className="font-semibold text-sm">{me.username}</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Signed in as you</p>
              </div>
            </div>

            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>Chat wallpaper</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  title={wp.label}
                  onClick={() => setWallpaper(wp.id)}
                  className={`wallpaper-swatch wallpaper-swatch-${wp.id} ${wallpaper === wp.id ? 'selected' : ''}`}
                />
              ))}
            </div>

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
                <button onClick={endCall} className="call-control-btn end" title="End call">📵</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
