'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FaceCapture from '@/components/FaceCapture';
import HeartField from '@/components/HeartField';

// Same 18 photos shipped in public/img/gallery, split into two rows that
// scroll in opposite directions — matches index.php's marquee wall.
const GALLERY = [
  'g01_diya.jpg', 'g02_selfie.jpg', 'g03_green.jpg', 'g04_ethnic.jpg', 'g05_smile.jpg',
  'g06_couple_mall.jpg', 'g07_couple_road.jpg', 'g08_hallway.jpg', 'g09_saree.jpg',
  'g10_olive.jpg', 'g11_cake.jpg', 'g12_couple_stairs.jpg', 'g13_orange.jpg',
  'g14_temple_bag.jpg', 'g15_couple_temple1.jpg', 'g16_couple_tree.jpg',
  'g17_green_sit.jpg', 'g18_couple_temple2.jpg',
];
const half = Math.ceil(GALLERY.length / 2);
const rowA = GALLERY.slice(0, half);
const rowB = GALLERY.slice(half);

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loginMode, setLoginMode] = useState('pin'); // 'pin' | 'face'
  const [regStep, setRegStep] = useState(1); // 1: name+pin, 2: face enrol
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchTab(next) {
    setTab(next);
    setError('');
    setLoginMode('pin');
    setRegStep(1);
  }

  async function submitPinLogin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pin', username, pin }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      router.push('/chat');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFaceLogin(descriptor) {
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'face', descriptor }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error || 'Face not recognised.');
      return;
    }
    router.push('/chat');
  }

  function goToFaceEnrolStep(e) {
    e.preventDefault();
    setError('');
    setRegStep(2);
  }

  async function finishRegister(descriptor) {
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin, descriptor: descriptor || undefined }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error || 'Something went wrong.');
      setRegStep(1); // e.g. name already taken — back to step 1
      return;
    }
    router.push('/chat');
  }

  const inputClass =
    'mt-1 w-full rounded-xl border border-red-900/30 bg-white/5 px-4 py-2.5 text-white placeholder-white/30 focus:ring-2 focus:ring-red-500 outline-none';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <HeartField />

      {/* Moving wall of memories, two rows scrolling opposite directions */}
      <div className="w-full max-w-5xl mb-6 space-y-2 relative z-10" aria-hidden="true">
        <div className="marquee-row">
          <div className="marquee-track">
            {[...rowA, ...rowA].map((f, i) => (
              <img key={i} src={`/img/gallery/${f}`} loading="lazy" alt="" />
            ))}
          </div>
        </div>
        <div className="marquee-row">
          <div className="marquee-track reverse">
            {[...rowB, ...rowB].map((f, i) => (
              <img key={i} src={`/img/gallery/${f}`} loading="lazy" alt="" />
            ))}
          </div>
        </div>
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="relative text-center mb-6">
          <div className="glow-ring" aria-hidden="true" />
          <p className="sparkle-divider text-xs uppercase tracking-widest mb-2 relative">
            ✦ a private space for two ✦
          </p>
          <h1 className="font-display text-4xl md:text-5xl relative" style={{ color: 'var(--ink)' }}>
            RITIKOMAL <span style={{ color: 'var(--red-deep)' }}>LOVE</span>
          </h1>
          <p className="text-sm mt-2 relative" style={{ color: 'var(--ink-soft)' }}>
            Your chats, your calls, your memories — just the two of you.
          </p>
        </div>

        <div className="glass auth-card rounded-3xl p-7 md:p-8">
          <h2 className="font-display text-lg text-center mb-4" style={{ color: 'var(--ink)' }}>
            Sign in or create your space
          </h2>

          <div className="flex mb-6 rounded-full bg-white/5 p-1 border border-red-900/30">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${tab === 'login' ? 'btn-love' : 'btn-ghost'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${tab === 'register' ? 'btn-love' : 'btn-ghost'}`}
            >
              Registration
            </button>
          </div>

          {tab === 'login' && (
            <div>
              <div className="flex justify-center gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setLoginMode('pin')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold ${loginMode === 'pin' ? 'btn-love' : 'btn-ghost'}`}
                >
                  PIN
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('face')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold ${loginMode === 'face' ? 'btn-love' : 'btn-ghost'}`}
                >
                  Face ID
                </button>
              </div>

              {loginMode === 'pin' ? (
                <form onSubmit={submitPinLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>Your name</label>
                    <input
                      className={inputClass}
                      placeholder="Ritik or Komal"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>6-digit PIN</label>
                    <input
                      className={`${inputClass} tracking-[0.5em] text-center`}
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="••••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" disabled={busy} className="w-full btn-love rounded-xl py-2.5 font-semibold">
                    {busy ? 'Please wait…' : 'Enter our world →'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 text-center">
                  <FaceCapture buttonLabel="Scan my face 💫" onCapture={submitFaceLogin} />
                </div>
              )}
            </div>
          )}

          {tab === 'register' && regStep === 1 && (
            <form onSubmit={goToFaceEnrolStep} className="space-y-4">
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>Choose your name</label>
                <input
                  className={inputClass}
                  placeholder="Ritik or Komal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>Create a 6-digit PIN</label>
                <input
                  className={`${inputClass} tracking-[0.5em] text-center`}
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="w-full btn-love rounded-xl py-2.5 font-semibold">
                Continue to face setup →
              </button>
            </form>
          )}

          {tab === 'register' && regStep === 2 && (
            <div className="space-y-3 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Set up Face Recognition</p>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                Look straight at the camera in good light, then tap scan. This lets you log in with just your face next time.
              </p>
              <FaceCapture buttonLabel="Scan & create our space ✨" onCapture={finishRegister} />
              <button type="button" onClick={() => finishRegister(null)} className="w-full btn-ghost rounded-xl py-2 text-sm">
                Skip for now (PIN only)
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--red-deep)' }}>{error}</p>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--ink-soft)' }}>
          made with ♥ for Ritik &amp; Komal
        </p>
      </main>

      <footer style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, opacity: 0.6 }}>
        Design &amp; developed by Nexwork Tech
      </footer>
    </div>
  );
}
