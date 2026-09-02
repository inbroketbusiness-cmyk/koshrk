'use client';

import { useEffect, useRef } from 'react';

// Ported from the original js/auth.js spawnHearts() — purely decorative,
// ambient floating hearts drifting up behind the auth/chat screens.
export default function HeartField() {
  const fieldRef = useRef(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const glyphs = ['♥', '❤', '💗', '💕', '💖'];
    const drifts = ['', 'drift-left', 'drift-right'];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'float-heart ' + drifts[i % drifts.length];
      span.textContent = glyphs[i % glyphs.length];
      span.style.left = Math.random() * 100 + '%';
      span.style.fontSize = 14 + Math.random() * 30 + 'px';
      span.style.animationDuration = 7 + Math.random() * 11 + 's';
      span.style.animationDelay = -Math.random() * 18 + 's';
      field.appendChild(span);
    }
  }, []);

  return (
    <div
      ref={fieldRef}
      className="pointer-events-none fixed inset-0 overflow-hidden -z-0"
      aria-hidden="true"
    />
  );
}
