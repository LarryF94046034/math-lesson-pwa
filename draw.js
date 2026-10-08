/** Degrees the board soft-rotates the UI (0 or 90). */
export function boardRotateDeg() {
  const n = Number(document.getElementById("board")?.dataset?.rot || 0);
  return n === 90 ? 90 : 0;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/** Sum offsetLeft/Top from el up to (but not including) ancestor. */
function offsetInAncestor(el, ancestor) {
  let x = 0;
  let y = 0;
  let n = el;
  while (n && n !== ancestor) {
    x += n.offsetLeft;
    y += n.offsetTop;
    const parent = n.offsetParent;
    if (parent === ancestor) break;
    if (!parent) {
      n = n.parentElement;
      continue;
    }
    n = parent;
  }
  return { x, y };
}

/**
 * Map pointer → canvas local fractions [0..1].
 * Prefer offsetX/Y; under soft-rotate fall back through the rotator matrix.
 */
export function pointerToFraction(el, e) {
  const w = Math.max(1, el.clientWidth || 1);
  const h = Math.max(1, el.clientHeight || 1);

  if (e && Number.isFinite(e.offsetX) && Number.isFinite(e.offsetY)) {
    // offsetX/Y are element-local on Chrome/Android even with ancestor CSS rotate.
    if (e.target === el || e.currentTarget === el) {
      return { x: clamp01(e.offsetX / w), y: clamp01(e.offsetY / h) };
    }
  }

  const clientX = e.clientX;
  const clientY = e.clientY;

  if (boardRotateDeg() === 90) {
    const rotator = document.getElementById("board-rotator");
    if (rotator) {
      const rr = rotator.getBoundingClientRect();
      const rw = Math.max(1, rotator.clientWidth || rr.width);
      const rh = Math.max(1, rotator.clientHeight || rr.height);
      const rcx = rr.left + rr.width / 2;
      const rcy = rr.top + rr.height / 2;
      // Inverse of CSS rotate(90deg) around rotator center: (sx,sy) → (sy, -sx)
      const rotX = rw / 2 + (clientY - rcy);
      const rotY = rh / 2 - (clientX - rcx);
      const off = offsetInAncestor(el, rotator);
      return {
        x: clamp01((rotX - off.x) / w),
        y: clamp01((rotY - off.y) / h),
      };
    }
  }

  const r = el.getBoundingClientRect();
  return {
    x: clamp01((clientX - r.left) / Math.max(1, r.width)),
    y: clamp01((clientY - r.top) / Math.max(1, r.height)),
  };
}

/** Map screen movement into element-local pixels under soft-rotate. */
export function screenDeltaToLocal(dx, dy) {
  if (boardRotateDeg() === 90) {
    return { dx: dy, dy: -dx };
  }
  return { dx, dy };
}

export class DrawBoard {
  constructor(canvas, { onStroke, label = "" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.onStroke = onStroke;
    this.label = label;
    this.strokes = [];
    this.active = null;
    this.tool = "none";
    this.penPx = 6;
    this.eraserPx = 28;
    this.color = "#c62828";
    this.inputLocked = false;
    this._bind();
    this.resize();
  }

  _bind() {
    const el = this.canvas;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => this._down(e));
    el.addEventListener("pointermove", (e) => this._move(e));
    el.addEventListener("pointerup", (e) => this._up(e));
    el.addEventListener("pointercancel", () => {
      this.active = null;
      this.paint();
    });
  }

  setTool(tool) {
    this.tool = tool;
    this.active = null;
  }

  setInputLocked(locked) {
    this.inputLocked = !!locked;
    if (locked) this.active = null;
  }

  setStyle({ penPx, eraserPx, color }) {
    if (penPx != null) this.penPx = penPx;
    if (eraserPx != null) this.eraserPx = eraserPx;
    if (color != null) this.color = color;
  }

  setStrokes(strokes) {
    this.strokes = strokes ? strokes.map((s) => ({ ...s, points: (s.points || []).slice() })) : [];
    this.active = null;
    this.paint();
  }

  clear() {
    this.strokes = [];
    this.active = null;
    this.paint();
  }

  resize() {
    // Use layout size, not getBoundingClientRect (swaps under rotate(90deg)).
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = Math.max(1, this.canvas.clientWidth || 1);
    const cssH = Math.max(1, this.canvas.clientHeight || 1);
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.paint();
  }

  _pos(e) {
    return pointerToFraction(this.canvas, e);
  }

  _down(e) {
    if (this.inputLocked || this.tool === "none") return;
    e.preventDefault();
    e.stopPropagation();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    const p = this._pos(e);
    const width = (this.tool === "eraser" ? this.eraserPx : this.penPx) / Math.max(1, this.canvas.clientWidth);
    this.active = {
      eraser: this.tool === "eraser",
      widthFraction: width,
      color: this.color,
      points: [p],
    };
    this.paint();
  }

  _move(e) {
    if (this.inputLocked || !this.active) return;
    e.preventDefault();
    this.active.points.push(this._pos(e));
    this.paint();
  }

  _up(e) {
    if (!this.active) return;
    e.preventDefault();
    this.active.points.push(this._pos(e));
    const finished = this.active;
    this.strokes.push(finished);
    this.active = null;
    this.paint();
    if (this.onStroke) this.onStroke(finished);
  }

  paint() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    for (const s of this.strokes) this._stroke(ctx, s, w, h);
    if (this.active) this._stroke(ctx, this.active, w, h);
    if (this.label) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#9aa7b2";
      ctx.font = `${Math.max(14, w * 0.035)}px sans-serif`;
      ctx.fillText(this.label, 12, 28);
    }
  }

  _stroke(ctx, stroke, w, h) {
    if (!stroke?.points?.length) return;
    const width = Math.max(2, (stroke.widthFraction || 0.02) * w);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = width;
    // Eraser paints white so it reliably covers ink on an opaque canvas.
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.eraser ? "#ffffff" : stroke.color || "#c62828";
    ctx.fillStyle = stroke.eraser ? "#ffffff" : stroke.color || "#c62828";

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
    }
    ctx.stroke();
  }
}

export class ZoomImage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.img = null;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.fitScale = 1;
    this.pointers = new Map();
    this._bind();
  }

  _bind() {
    const el = this.canvas;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      if (this.pointers.size === 1) {
        const { dx, dy } = screenDeltaToLocal(e.clientX - prev.x, e.clientY - prev.y);
        this.panX += dx;
        this.panY += dy;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.paint();
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.entries()];
        const other = pts[0][0] === e.pointerId ? pts[1][1] : pts[0][1];
        const oldDist = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
        const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y) || 1;
        const focus = pointerToFraction(el, {
          target: null,
          clientX: (e.clientX + other.x) / 2,
          clientY: (e.clientY + other.y) / 2,
        });
        const fx = focus.x * el.clientWidth;
        const fy = focus.y * el.clientHeight;
        let next = this.scale * (newDist / oldDist);
        next = Math.min(this.fitScale * 6, Math.max(this.fitScale * 0.8, next));
        const factor = next / this.scale;
        this.panX = fx - factor * (fx - this.panX);
        this.panY = fy - factor * (fy - this.panY);
        this.scale = next;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.paint();
      }
    });
    const end = (e) => this.pointers.delete(e.pointerId);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("dblclick", () => {
      this.fit();
      this.paint();
    });
    el.addEventListener(
      "wheel",
      (e) => {
        if (!this.img) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        const focus = pointerToFraction(el, e);
        const fx = focus.x * (el.clientWidth || 1);
        const fy = focus.y * (el.clientHeight || 1);
        this._zoomAt(factor, fx, fy);
      },
      { passive: false }
    );
  }

  _zoomAt(factor, fx, fy) {
    if (!this.img) return;
    let next = this.scale * factor;
    next = Math.min(this.fitScale * 6, Math.max(this.fitScale * 0.5, next));
    const actualFactor = next / this.scale;
    this.panX = fx - actualFactor * (fx - this.panX);
    this.panY = fy - actualFactor * (fy - this.panY);
    this.scale = next;
    this.paint();
  }

  zoomBy(factor) {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this._zoomAt(factor, w / 2, h / 2);
  }

  resetZoom() {
    this.fit();
    this.paint();
  }

  async setSrc(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    this.img = img;
    this.resize();
    this.fit();
    this.paint();
  }

  resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor((this.canvas.clientWidth || 1) * dpr));
    this.canvas.height = Math.max(1, Math.floor((this.canvas.clientHeight || 1) * dpr));
    this.paint();
  }

  fit() {
    if (!this.img) return;
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.fitScale = Math.min(width / this.img.naturalWidth, height / this.img.naturalHeight);
    this.scale = this.fitScale;
    this.panX = (width - this.img.naturalWidth * this.scale) / 2;
    this.panY = (height - this.img.naturalHeight * this.scale) / 2;
  }

  paint() {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    if (!this.img) return;
    ctx.drawImage(
      this.img,
      this.panX,
      this.panY,
      this.img.naturalWidth * this.scale,
      this.img.naturalHeight * this.scale
    );
  }
}
