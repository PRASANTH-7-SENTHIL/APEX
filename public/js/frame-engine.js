/**
 * APEX INFRASTRUCTURE — Cinematic Frame Engine
 * Scroll-controlled PNG sequence renderer using high-DPI Canvas.
 * Progressive loading, sliding-window cache, smooth lerp scrubbing.
 */
(function () {
  'use strict';

  const TOTAL_FRAMES = 268;
  const FRAME_BASE = '/frames/frame_';
  const FRAME_EXT = '.png';
  // Pad frame number to 6 digits starting at 1
  function frameName(i) {
    return FRAME_BASE + String(i).padStart(6, '0') + FRAME_EXT;
  }

  // ─── State ─────────────────────────────────────────────────────────────────
  const state = {
    canvas: null,
    ctx: null,
    images: new Array(TOTAL_FRAMES).fill(null),   // loaded Image objects or null
    loading: new Array(TOTAL_FRAMES).fill(false),  // in-flight requests
    currentFrameF: 0,   // float (lerp target)
    displayedFrame: -1, // last drawn frame index
    targetFrame: 0,
    loadedCount: 0,
    initialBatchLoaded: false,
    rafId: null,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    onProgress: null,   // callback(pct)
    onReady: null,      // callback()
    onFrameChange: null // callback(frameIndex)
  };

  // Sliding-window prefetch: how many frames ahead/behind to preload
  const WINDOW = 30;
  const INITIAL_BATCH = 20; // frames to load before showing ready

  // ─── Canvas Setup ──────────────────────────────────────────────────────────
  function initCanvas(canvasEl) {
    state.canvas = canvasEl;
    state.ctx = canvasEl.getContext('2d', { alpha: false });
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
  }

  function resizeCanvas() {
    const c = state.canvas;
    const w = window.innerWidth;
    const h = window.innerHeight;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.width = Math.round(w * state.dpr);
    c.height = Math.round(h * state.dpr);
    drawCurrentFrame();
  }

  // ─── Image Loading ─────────────────────────────────────────────────────────
  function loadFrame(idx) {
    if (idx < 0 || idx >= TOTAL_FRAMES) return;
    if (state.images[idx] || state.loading[idx]) return;
    state.loading[idx] = true;
    const img = new Image();
    img.onload = () => {
      state.images[idx] = img;
      state.loading[idx] = false;
      state.loadedCount++;
      const pct = Math.round((state.loadedCount / TOTAL_FRAMES) * 100);
      if (state.onProgress) state.onProgress(pct);
      if (!state.initialBatchLoaded && state.loadedCount >= INITIAL_BATCH) {
        state.initialBatchLoaded = true;
        if (state.onReady) state.onReady();
      }
      if (idx === Math.round(state.currentFrameF)) drawCurrentFrame();
    };
    img.onerror = () => { state.loading[idx] = false; };
    img.src = frameName(idx + 1); // frames start at 1
  }

  function preloadWindow(centerIdx) {
    const start = Math.max(0, centerIdx - WINDOW);
    const end = Math.min(TOTAL_FRAMES - 1, centerIdx + WINDOW);
    // Load frames nearest to center first
    for (let offset = 0; offset <= (end - start); offset++) {
      const a = centerIdx - offset;
      const b = centerIdx + offset;
      if (a >= start) loadFrame(a);
      if (b <= end && b !== a) loadFrame(b);
    }
  }

  function loadAllRemaining() {
    // Low-priority sequential load for all frames not yet loaded
    let i = 0;
    function loadNext() {
      while (i < TOTAL_FRAMES && (state.images[i] || state.loading[i])) i++;
      if (i >= TOTAL_FRAMES) return;
      const img = new Image();
      const idx = i;
      img.onload = () => {
        state.images[idx] = img;
        state.loading[idx] = false;
        state.loadedCount++;
        const pct = Math.round((state.loadedCount / TOTAL_FRAMES) * 100);
        if (state.onProgress) state.onProgress(pct);
        loadNext();
      };
      img.onerror = () => { state.loading[idx] = false; loadNext(); };
      img.src = frameName(idx + 1);
      state.loading[idx] = true;
      i++;
    }
    // Stagger start
    setTimeout(loadNext, 500);
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────
  function drawCurrentFrame() {
    const frameIdx = Math.round(state.currentFrameF);
    const img = state.images[frameIdx];
    if (!img) {
      // Try nearest available frame
      const fallback = findNearestFrame(frameIdx);
      if (fallback === null) return;
      drawImage(state.images[fallback]);
      return;
    }
    drawImage(img);
    if (frameIdx !== state.displayedFrame) {
      state.displayedFrame = frameIdx;
      if (state.onFrameChange) state.onFrameChange(frameIdx);
    }
  }

  function findNearestFrame(idx) {
    for (let d = 1; d < 30; d++) {
      if (idx - d >= 0 && state.images[idx - d]) return idx - d;
      if (idx + d < TOTAL_FRAMES && state.images[idx + d]) return idx + d;
    }
    return null;
  }

  function drawImage(img) {
    const c = state.canvas;
    const ctx = state.ctx;
    ctx.save();
    ctx.scale(state.dpr, state.dpr);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    // object-fit: cover
    const scale = Math.max(vw / iw, vh / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (vw - dw) / 2;
    const dy = (vh - dh) / 2;
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  // ─── Animation Loop ────────────────────────────────────────────────────────
  const LERP_SPEED = 0.18;

  function tick() {
    state.rafId = requestAnimationFrame(tick);
    const diff = state.targetFrame - state.currentFrameF;
    if (Math.abs(diff) < 0.01) {
      if (state.currentFrameF !== state.targetFrame) {
        state.currentFrameF = state.targetFrame;
        drawCurrentFrame();
      }
      return;
    }
    state.currentFrameF += diff * LERP_SPEED;
    drawCurrentFrame();
    // Prefetch around current position
    preloadWindow(Math.round(state.currentFrameF));
  }

  // ─── Scroll → Frame Mapping ────────────────────────────────────────────────
  function setTargetFromScrollProgress(progress) {
    // progress: 0.0 to 1.0
    const clamped = Math.max(0, Math.min(1, progress));
    state.targetFrame = Math.round(clamped * (TOTAL_FRAMES - 1));
    preloadWindow(state.targetFrame);
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  window.FrameEngine = {
    init(canvasEl, opts) {
      state.onProgress = opts.onProgress || null;
      state.onReady = opts.onReady || null;
      state.onFrameChange = opts.onFrameChange || null;
      initCanvas(canvasEl);
      // Load initial batch sequentially for fastest time-to-ready
      for (let i = 0; i < INITIAL_BATCH; i++) loadFrame(i);
      // After initial batch, load window around frame 0
      setTimeout(() => {
        preloadWindow(0);
        loadAllRemaining();
      }, 200);
      tick();
    },
    setProgress(progress) {
      setTargetFromScrollProgress(progress);
    },
    getFrameCount() {
      return TOTAL_FRAMES;
    },
    getLoadedCount() {
      return state.loadedCount;
    },
    isReady() {
      return state.initialBatchLoaded;
    },
    getCurrentFrame() {
      return Math.round(state.currentFrameF);
    },
    jumpToFrame(idx) {
      state.currentFrameF = idx;
      state.targetFrame = idx;
      drawCurrentFrame();
    }
  };
})();
