'use client';

import { useEffect, useRef, useState } from 'react';

// Same public model mirror the original vanilla-JS version used. The
// "face-api.js-models" repo nests weights per-model, which breaks
// loadFromUri()'s manifest fetch — the main repo's weights/ folder is flat,
// which is what loadFromUri() expects.
const FACE_MODEL_URL =
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

let modelsLoadedPromise = null;
function loadModels(faceapi) {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]);
  }
  return modelsLoadedPromise;
}

/**
 * Renders a live webcam preview + "Scan" button. Calls onCapture(descriptor)
 * with a plain 128-number array once a face is found, or onError(message)
 * if the camera/models fail or no face is detected.
 *
 * Usage:
 *   <FaceCapture buttonLabel="Scan my face" onCapture={(d) => ...} />
 */
export default function FaceCapture({ buttonLabel = 'Scan', onCapture, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('Loading face models…');
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // face-api.js touches browser globals, so it's loaded dynamically
        // client-side only (never during SSR/build).
        const faceapi = await import('face-api.js');
        await loadModels(faceapi);
        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, // front camera on phones
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus(`Look at the camera and tap "${buttonLabel}".`);
        setReady(true);
      } catch (err) {
        console.error(err);
        setStatus('Camera or face models unavailable — use your PIN instead.');
        onError?.('Camera or face models unavailable.');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCapture() {
    if (!ready || scanning) return;
    setScanning(true);
    setStatus('Scanning…');
    try {
      const faceapi = await import('face-api.js');
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('No face found — move closer and try again.');
        return;
      }
      const descriptor = Array.from(detection.descriptor);
      onCapture(descriptor);
    } catch (err) {
      console.error(err);
      setStatus('Could not scan — try again or use your PIN.');
      onError?.('Face scan failed.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div className="relative mx-auto w-56 h-56 rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="face-scan-frame" />
        <div className="scan-line" />
      </div>
      <p className="text-xs text-center" style={{ color: 'var(--ink-soft)' }}>{status}</p>
      <button
        type="button"
        onClick={handleCapture}
        disabled={!ready || scanning}
        className="w-full btn-love rounded-xl py-2.5 font-semibold"
      >
        {scanning ? 'Scanning…' : buttonLabel}
      </button>
    </div>
  );
}
