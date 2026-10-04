export class DrawBoard {
  constructor(canvas, { onStroke, label = "" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onStroke = onStroke;
    this.label = label;
    this.strokes = [];
    this.active = null;
    this.tool = "none";
    this.penPx = 6;
    this.eraserPx = 28;
    this.color = "#c62828";
    this._bind();
    this.resize();
  }

  _bind() {
    const el = this.canvas;
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

  setStyle({ penPx, eraserPx, color }) {
    if (penPx != null) this.penPx = penPx;
    if (eraserPx != null) this.eraserPx = eraserPx;
    if (color != null) this.color = color;
  }

  setStrokes(strokes) {
    this.strokes = strokes ? strokes.map((s) => ({ ...s, points: s.points.slice() })) : [];
    this.active = null;
    this.paint();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.paint();
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }

  _down(e) {
    if (this.tool === "none") return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this._pos(e);
    const width = (this.tool === "eraser" ? this.eraserPx : this.penPx) / this.canvas.clientWidth;
    this.active = {
      eraser: this.tool === "eraser",
      widthFraction: width,
      color: this.color,
      points: [p],
    };
    this.paint();
  }

  _move(e) {
    if (!this.active) return;
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    for (const s of this.strokes) this._stroke(ctx, s, w, h);
    if (this.active) this._stroke(ctx, this.active, w, h);
    ctx.restore();
    if (this.label) {
      ctx.fillStyle = "#9aa7b2";
      ctx.font = `${Math.max(14, w * 0.035)}px sans-serif`;
      ctx.fillText(this.label, 12, 28);
    }
  }

  _stroke(ctx, stroke, w, h) {
    if (!stroke.points.length) return;
    const width = Math.max(2, stroke.widthFraction * w);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = width;
    if (stroke.eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color || "#c62828";
    }
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.eraser ? "rgba(0,0,0,1)" : stroke.color;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
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
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      if (this.pointers.size === 1) {
        this.panX += e.clientX - prev.x;
        this.panY += e.clientY - prev.y;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.paint();
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.entries()];
        const other = pts[0][0] === e.pointerId ? pts[1][1] : pts[0][1];
        const oldDist = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
        const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y) || 1;
        const focusX = (e.clientX + other.x) / 2;
        const focusY = (e.clientY + other.y) / 2;
        const r = el.getBoundingClientRect();
        const fx = focusX - r.left;
        const fy = focusY - r.top;
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
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.paint();
  }

  fit() {
    if (!this.img) return;
    const r = this.canvas.getBoundingClientRect();
    this.fitScale = Math.min(r.width / this.img.naturalWidth, r.height / this.img.naturalHeight);
    this.scale = this.fitScale;
    this.panX = (r.width - this.img.naturalWidth * this.scale) / 2;
    this.panY = (r.height - this.img.naturalHeight * this.scale) / 2;
  }

  paint() {
    const ctx = this.ctx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = this.canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, r.width, r.height);
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
