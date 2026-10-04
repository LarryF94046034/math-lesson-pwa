import { getKv, setKv, inkKey } from "./db.js";
import { DrawBoard, ZoomImage } from "./draw.js";

const ASSET_BASE = new URL("./", import.meta.url);
const TOTAL_MS = 90 * 60 * 1000;

function asset(path) {
  return new URL(path.replace(/^\.\//, ""), ASSET_BASE).href;
}
const COLORS = ["#c62828", "#1565c0", "#212121", "#2e7d32", "#ef6c00", "#6a1b9a"];
const TEXT_COLORS = ["#212121", "#1565c0", "#c62828", "#2e7d32"];

const app = document.getElementById("app");
let data = null;
let lesson = null;
let prefs = null;
let favorites = [];
let tickTimer = null;
let boardState = null;

async function boot() {
  const res = await fetch(asset("data/questions.json"));
  if (!res.ok) throw new Error("questions.json " + res.status);
  data = await res.json();
  lesson = (await getKv("lesson")) || {
    remainingMs: TOTAL_MS,
    running: false,
    anchorAt: 0,
    done: Array(7).fill(false),
    notes: Array(7).fill(""),
  };
  prefs = (await getKv("prefs")) || {
    penPx: 6,
    eraserPx: 28,
    color: COLORS[0],
    textSp: 22,
    textColor: TEXT_COLORS[0],
    layout: "landscape",
    layoutLocked: false,
  };
  if (!prefs.layout) prefs.layout = "landscape";
  if (typeof prefs.layoutLocked !== "boolean") prefs.layoutLocked = false;
  favorites = (await getKv("favorites")) || [];
  renderHome();
  startTick();
}

function remaining() {
  if (!lesson.running) return lesson.remainingMs;
  return Math.max(0, lesson.remainingMs - (Date.now() - lesson.anchorAt));
}

function clock(ms) {
  const t = Math.floor(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function saveLesson() {
  if (lesson.running) {
    lesson.remainingMs = remaining();
    lesson.anchorAt = Date.now();
  }
  await setKv("lesson", lesson);
}

async function savePrefs() {
  await setKv("prefs", prefs);
}

function startTick() {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!app.querySelector("#home-timer")) return;
    if (lesson.running && remaining() <= 0) {
      lesson.running = false;
      lesson.remainingMs = 0;
      saveLesson();
    }
    const el = document.getElementById("home-timer");
    if (el) el.textContent = clock(remaining());
    const pace = document.getElementById("home-pace");
    if (pace) pace.textContent = paceText();
  }, 500);
}

function paceText() {
  if (!lesson.running && remaining() === TOTAL_MS) return "建議先從講義四區開始，再按開始上課";
  if (remaining() <= 0) return "時間到。段落勾選與畫記仍留在這支手機";
  return "上課中，可同時使用講義／作答四區";
}

function questionsOf(zone) {
  return data.questions[zone] || [];
}

function renderHome() {
  boardState = null;
  const doneCount = (lesson.done || []).filter(Boolean).length;
  app.innerHTML = `
  <div class="screen">
    <div class="muted">國中數學 1 上　教用　網頁版／PWA</div>
    <div class="h1">90 分鐘教案</div>
    <div class="muted">範圍 1-1～1-4　資料存在這支手機的瀏覽器（IndexedDB）</div>

    <div class="h2">四區題目　講義</div>
    <div class="row" id="zones-lecture"></div>

    <div class="h2">四區作答　答案先遮住</div>
    <div class="row" id="zones-practice"></div>

    <div class="timer" id="home-timer">${clock(remaining())}</div>
    <div class="muted" style="text-align:center" id="home-pace">${paceText()}</div>
    <div class="row" style="margin-top:8px">
      <button class="primary" id="btn-toggle">${lesson.running ? "暫停" : "開始上課"}</button>
      <button id="btn-reset">計時歸零</button>
    </div>

    <div class="h2">收藏的題目</div>
    <div class="fav-list" id="fav-list"></div>

    <p class="muted">離線可用：第一次連線開啟後，之後無網路也可開。畫筆每一筆自動存檔；講義與作答分開存。</p>
  </div>`;

  const lec = document.getElementById("zones-lecture");
  const pra = document.getElementById("zones-practice");
  for (const z of data.zones) {
    lec.appendChild(zoneBtn(z, false));
    pra.appendChild(zoneBtn(z, true));
  }
  document.getElementById("btn-toggle").onclick = async () => {
    if (lesson.running) {
      lesson.remainingMs = remaining();
      lesson.running = false;
    } else if (remaining() > 0) {
      lesson.running = true;
      lesson.anchorAt = Date.now();
    }
    await saveLesson();
    renderHome();
  };
  document.getElementById("btn-reset").onclick = async () => {
    lesson.remainingMs = TOTAL_MS;
    lesson.running = false;
    await saveLesson();
    renderHome();
  };
  renderFavorites();
}

function zoneBtn(z, practice) {
  const b = document.createElement("button");
  b.textContent = `${practice ? z.title + "作答" : z.title}\n${z.pages}`;
  b.style.whiteSpace = "pre-line";
  b.onclick = () => renderZone(z.id, practice);
  return b;
}

async function renderFavorites() {
  const box = document.getElementById("fav-list");
  if (!box) return;
  favorites = (await getKv("favorites")) || [];
  box.innerHTML = "";
  if (!favorites.length) {
    box.innerHTML = `<div class="muted">還沒有收藏。在題目選單或做題畫面按收藏。</div>`;
    return;
  }
  for (const item of favorites) {
    const qs = questionsOf(item.zone);
    const q = qs[item.index];
    if (!q) continue;
    const z = data.zones.find((x) => x.id === item.zone);
    const b = document.createElement("button");
    b.textContent = `${item.practice ? "作答" : "講義"}　${z.title}　第 ${q.page} 頁　${q.label}`;
    b.onclick = () => openBoard(item.zone, item.index, item.practice);
    box.appendChild(b);
  }
}

async function renderZone(zoneId, practice) {
  const z = data.zones.find((x) => x.id === zoneId);
  const qs = questionsOf(zoneId);
  const resultsOn = practice && (await getKv("results:" + zoneId, false));
  let html = `
  <div class="screen">
    <button id="back-home">← 回首頁</button>
    <div class="h1">${z.title}　${z.pages}</div>
    <div class="muted">${practice ? "作答　答案先遮住" : "講義"}</div>
    <div class="q-list" id="q-list"></div>
  </div>`;
  app.innerHTML = html;
  document.getElementById("back-home").onclick = () => renderHome();
  const list = document.getElementById("q-list");
  let last = -1;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (q.page !== last) {
      last = q.page;
      const h = document.createElement("div");
      h.className = "page-head";
      h.textContent = `第 ${q.page} 頁`;
      list.appendChild(h);
    }
    const row = document.createElement("div");
    row.className = "row";
    row.style.marginBottom = "8px";
    const b = document.createElement("button");
    let suffix = q.kind === "choice" ? "　選擇題" : "　填充／計算";
    if (resultsOn) {
      const typed = (await getKv("attempt:" + q.id, "")) || "";
      const ok = matchAnswer(q, typed);
      if (!String(typed).trim()) suffix += "　未作答";
      else if (ok == null) suffix += "　未核對";
      else suffix += ok ? "　符合" : "　不符合";
    }
    b.textContent = q.label + suffix;
    b.onclick = () => openBoard(zoneId, i, practice);
    const star = document.createElement("button");
    const fav = isFav(zoneId, i, practice);
    star.textContent = fav ? "已收藏" : "收藏";
    star.style.flex = "0 0 88px";
    star.onclick = async () => {
      await toggleFav(zoneId, i, practice);
      renderZone(zoneId, practice);
    };
    row.appendChild(b);
    row.appendChild(star);
    list.appendChild(row);
  }
  if (practice) {
    const result = document.createElement("button");
    result.className = "primary";
    result.textContent = resultsOn ? "隱藏結果" : "結果";
    result.onclick = async () => {
      await setKv("results:" + zoneId, !resultsOn);
      renderZone(zoneId, practice);
    };
    list.appendChild(result);
  }
}

function isFav(zone, index, practice) {
  return favorites.some((f) => f.zone === zone && f.index === index && !!f.practice === !!practice);
}

async function toggleFav(zone, index, practice) {
  favorites = (await getKv("favorites")) || [];
  const key = `${zone}|${index}|${practice ? 1 : 0}`;
  const next = favorites.filter((f) => `${f.zone}|${f.index}|${f.practice ? 1 : 0}` !== key);
  if (next.length === favorites.length) next.push({ zone, index, practice: !!practice });
  favorites = next;
  await setKv("favorites", favorites);
}

function norm(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[ \n\t　]/g, "")
    .replace(/[−–－]/g, "-")
    .replace(/[×＊*]/g, "x")
    .replace(/＞/g, ">")
    .replace(/＜/g, "<")
    .replace(/＝/g, "=")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/元/g, "")
    .replace(/次方/g, "")
    .replace(/\^/g, "");
}

function matchAnswer(q, typed) {
  const expected = q.answer || "";
  if (!expected) return null;
  if (!String(typed || "").trim()) return false;
  const got = norm(typed);
  return expected.split("|").some((alt) => {
    const parts = alt.split("&");
    if (q.kind === "choice" && parts.length === 1) {
      const letter = (norm(parts[0]).match(/[a-d]/) || [])[0] || "";
      const g = (got.match(/[a-d]/) || [])[0] || "";
      return letter && letter === g;
    }
    return parts.every((p) => {
      const part = norm(p);
      return !part || got.includes(part);
    });
  });
}

function coverCanvas(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { width: w, height: h } = c;
  const data = ctx.getImageData(0, 0, w, h);
  const mark = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.data.length; i += 4, p++) {
    const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
    if (r > 130 && r > g + 28 && r > b + 10) mark[p] = 1;
  }
  ctx.fillStyle = "#ffecb3";
  const step = Math.max(4, Math.floor(w / 80));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      let hit = false;
      for (let yy = Math.max(0, y - step); yy <= Math.min(h - 1, y + step) && !hit; yy += 2)
        for (let xx = Math.max(0, x - step); xx <= Math.min(w - 1, x + step); xx += 2)
          if (mark[yy * w + xx]) { hit = true; break; }
      if (hit) ctx.fillRect(x - step, y - step / 2, step * 2, step * 1.6);
    }
  }
  ctx.strokeStyle = "#ef6c00";
  ctx.lineWidth = 3;
  // broad fallback covers
  ctx.fillRect(0, 0, w * 0.18, h * 0.42);
  return c.toDataURL("image/jpeg", 0.85);
}

async function openBoard(zoneId, index, practice) {
  const qs = questionsOf(zoneId);
  const z = data.zones.find((x) => x.id === zoneId);
  let reveal = !practice;
  let inkDoc = (await getKv(inkKey(qs[index].id, practice))) || { zones: {}, order: [] };
  ensureInk(inkDoc);

  app.innerHTML = `
  <div class="board layout-landscape" id="board">
    <div class="board-rotator" id="board-rotator">
      <div class="board-top">
        <button id="btn-back">返回</button>
        <div class="board-title" id="board-title"></div>
        <button class="orient-btn" id="btn-lock-view">固定畫面</button>
        <span class="tool-label">字</span>
        <input class="seek" type="range" id="text-size" min="0" max="28" />
        <span id="text-colors"></span>
        <button id="btn-fav">收藏</button>
        <button id="btn-solution" style="display:none">解答</button>
        <button id="btn-prev">上一題</button>
        <button id="btn-next">下一題</button>
      </div>
      <div class="board-tools">
        <button id="btn-draw">繪圖</button>
        <button id="btn-undo">重製</button>
        <button id="btn-eraser">橡皮擦</button>
        <span class="tool-label">筆粗</span>
        <input class="seek" type="range" id="pen-size" min="0" max="40" />
        <span id="pen-label"></span>
        <span class="tool-label">橡皮</span>
        <input class="seek" type="range" id="eraser-size" min="0" max="80" />
        <span id="eraser-label"></span>
        <span id="pen-colors"></span>
      </div>
      <div class="board-status" id="board-status"></div>
      <div class="board-main">
        <div class="left-pane">
          <div class="zoom-box"><canvas id="zoom"></canvas></div>
          <div class="text-box" id="qtext"></div>
        </div>
        <div class="boards" id="boards"></div>
      </div>
      <div class="answer-card" id="answer-card" style="display:none">
        <div class="handle" id="answer-handle">答案區　按住這裡拖動</div>
        <textarea id="answer-input" placeholder="輸入這題的答案"></textarea>
      </div>
    </div>
  </div>`;

  const zoom = new ZoomImage(document.getElementById("zoom"));
  const boardsEl = document.getElementById("boards");
  const draws = [];
  let tool = "none";
  let marked = inkDoc.order.length ? inkDoc.order[inkDoc.order.length - 1] : "";

  function ensureBoards(q) {
    boardsEl.innerHTML = "";
    draws.length = 0;
    boardsEl.className = "boards " + (q.kind === "choice" ? "choice" : "open");
    const specs =
      q.kind === "choice"
        ? [
            ["A", "A　左上"],
            ["B", "B　右上"],
            ["C", "C　左下"],
            ["D", "D　右下"],
          ]
        : [["main", "作答區"]];
    for (const [zone, label] of specs) {
      const cell = document.createElement("div");
      cell.className = "draw-cell" + (zone === marked ? " active" : "");
      const canvas = document.createElement("canvas");
      const tag = document.createElement("div");
      tag.className = "draw-label";
      tag.textContent = label;
      cell.appendChild(canvas);
      cell.appendChild(tag);
      boardsEl.appendChild(cell);
      const board = new DrawBoard(canvas, {
        label,
        onStroke: async (stroke) => {
          if (!inkDoc.zones[zone]) inkDoc.zones[zone] = [];
          inkDoc.zones[zone].push(stroke);
          inkDoc.order.push(zone);
          marked = zone;
          await setKv(inkKey(q.id, practice), inkDoc);
          refreshMarks();
          updateStatus();
        },
      });
      board.setStrokes(inkDoc.zones[zone] || []);
      board.setStyle(prefs);
      board.setTool(tool);
      draws.push({ zone, board, cell });
    }
    resizeAll();
  }

  function refreshMarks() {
    for (const d of draws) d.cell.classList.toggle("active", d.zone === marked);
  }

  function resizeAll() {
    zoom.resize();
    for (const d of draws) d.board.resize();
  }

  function detectLayout() {
    return window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
  }

  function applyLayout() {
    const board = document.getElementById("board");
    if (!prefs.layoutLocked) {
      prefs.layout = detectLayout();
    }
    const layout = prefs.layout === "portrait" ? "portrait" : "landscape";
    board.classList.toggle("layout-portrait", layout === "portrait");
    board.classList.toggle("layout-landscape", layout === "landscape");
    // Phone upright but locked/using landscape: rotate UI to wide side.
    const needsRotate = layout === "landscape" && window.innerHeight > window.innerWidth;
    board.classList.toggle("needs-rotate", needsRotate);
    const lockBtn = document.getElementById("btn-lock-view");
    lockBtn.classList.toggle("selected", !!prefs.layoutLocked);
    lockBtn.textContent = prefs.layoutLocked ? "已固定" : "固定畫面";
    requestAnimationFrame(() => {
      resizeAll();
      requestAnimationFrame(resizeAll);
    });
  }

  function updateStatus() {
    const q = qs[index];
    const mode = tool === "pen" ? "繪圖開" : tool === "eraser" ? "橡皮擦開" : "瀏覽";
    const shape = q.kind === "choice" ? "右半邊四格" : "右半邊一整區";
    const total = Object.values(inkDoc.zones).reduce((n, a) => n + a.length, 0);
    document.getElementById("board-status").textContent =
      `${shape}　${mode}　已存 ${total} 筆` + (marked ? `　上一筆在 ${marked === "main" ? "作答區" : marked}` : "");
  }

  async function show() {
    const q = qs[index];
    inkDoc = (await getKv(inkKey(q.id, practice))) || { zones: {}, order: [] };
    ensureInk(inkDoc);
    marked = inkDoc.order.length ? inkDoc.order[inkDoc.order.length - 1] : "";
    document.getElementById("board-title").textContent =
      `${practice ? "作答" : "講義"}　${z.title}　第 ${q.page} 頁　${q.label}`;
    document.getElementById("btn-prev").disabled = index <= 0;
    document.getElementById("btn-next").disabled = index >= qs.length - 1;
    document.getElementById("btn-fav").textContent = isFav(zoneId, index, practice) ? "已收藏" : "收藏";
    const sol = document.getElementById("btn-solution");
    const card = document.getElementById("answer-card");
    if (practice) {
      sol.style.display = "";
      card.style.display = "";
      reveal = false;
      sol.textContent = "解答";
      const typed = (await getKv("attempt:" + q.id, "")) || "";
      document.getElementById("answer-input").value = typed;
      const fx = await getKv("attemptX:" + q.id, -1);
      const fy = await getKv("attemptY:" + q.id, -1);
      if (fx >= 0 && fy >= 0) {
        card.style.left = fx * window.innerWidth + "px";
        card.style.top = fy * window.innerHeight + "px";
        card.style.right = "auto";
      }
    } else {
      sol.style.display = "none";
      card.style.display = "none";
      reveal = true;
    }
    ensureBoards(q);
    refreshText();
    await loadImage(q);
    updateStatus();
  }

  function refreshText() {
    const q = qs[index];
    const box = document.getElementById("qtext");
    let text = q.body || "";
    if (reveal && q.answer) {
      text += "\n\n答案：" + q.answer.replace(/&/g, "、").replace(/\|/g, " 或 ");
    }
    box.textContent = text;
    box.style.fontSize = prefs.textSp + "px";
    box.style.color = prefs.textColor;
  }

  async function loadImage(q) {
    const img = new Image();
    const src = asset(q.image);
    img.src = src;
    await img.decode();
    if (practice && !reveal) {
      await zoom.setSrc(coverCanvas(img));
    } else {
      await zoom.setSrc(src);
    }
  }

  document.getElementById("btn-back").onclick = () => {
    window.removeEventListener("resize", onWinResize);
    window.removeEventListener("orientationchange", onWinResize);
    renderZone(zoneId, practice);
  };
  document.getElementById("btn-lock-view").onclick = async () => {
    if (prefs.layoutLocked) {
      prefs.layoutLocked = false;
      prefs.layout = detectLayout();
    } else {
      prefs.layout = detectLayout();
      prefs.layoutLocked = true;
    }
    await savePrefs();
    applyLayout();
  };
  document.getElementById("btn-prev").onclick = async () => {
    if (index > 0) {
      index--;
      await show();
    }
  };
  document.getElementById("btn-next").onclick = async () => {
    if (index + 1 < qs.length) {
      index++;
      await show();
    }
  };
  document.getElementById("btn-fav").onclick = async () => {
    await toggleFav(zoneId, index, practice);
    document.getElementById("btn-fav").textContent = isFav(zoneId, index, practice) ? "已收藏" : "收藏";
  };
  document.getElementById("btn-solution").onclick = async () => {
    reveal = !reveal;
    document.getElementById("btn-solution").textContent = reveal ? "隱藏解答" : "解答";
    refreshText();
    await loadImage(qs[index]);
  };
  document.getElementById("btn-draw").onclick = () => setTool(tool === "pen" ? "none" : "pen");
  document.getElementById("btn-eraser").onclick = () => setTool(tool === "eraser" ? "none" : "eraser");
  document.getElementById("btn-undo").onclick = async () => {
    if (!inkDoc.order.length) {
      alert("沒有上一筆畫");
      return;
    }
    const zone = inkDoc.order.pop();
    const arr = inkDoc.zones[zone] || [];
    arr.pop();
    marked = inkDoc.order.length ? inkDoc.order[inkDoc.order.length - 1] : "";
    await setKv(inkKey(qs[index].id, practice), inkDoc);
    for (const d of draws) {
      if (d.zone === zone) d.board.setStrokes(inkDoc.zones[zone] || []);
    }
    refreshMarks();
    updateStatus();
  };

  function setTool(next) {
    tool = next;
    for (const d of draws) d.board.setTool(tool);
    document.getElementById("btn-draw").classList.toggle("selected", tool === "pen");
    document.getElementById("btn-eraser").classList.toggle("selected", tool === "eraser");
    updateStatus();
  }

  const penSize = document.getElementById("pen-size");
  const eraserSize = document.getElementById("eraser-size");
  penSize.value = Math.max(0, Math.min(40, prefs.penPx - 2));
  eraserSize.value = Math.max(0, Math.min(80, prefs.eraserPx - 12));
  document.getElementById("pen-label").textContent = prefs.penPx;
  document.getElementById("eraser-label").textContent = prefs.eraserPx;
  penSize.oninput = async () => {
    prefs.penPx = +penSize.value + 2;
    document.getElementById("pen-label").textContent = prefs.penPx;
    for (const d of draws) d.board.setStyle(prefs);
    await savePrefs();
  };
  eraserSize.oninput = async () => {
    prefs.eraserPx = +eraserSize.value + 12;
    document.getElementById("eraser-label").textContent = prefs.eraserPx;
    for (const d of draws) d.board.setStyle(prefs);
    await savePrefs();
  };

  const penColors = document.getElementById("pen-colors");
  for (const c of COLORS) {
    const b = document.createElement("button");
    b.className = "color-dot";
    b.style.background = c;
    b.onclick = async () => {
      prefs.color = c;
      for (const d of draws) d.board.setStyle(prefs);
      if (tool !== "pen") setTool("pen");
      await savePrefs();
    };
    penColors.appendChild(b);
  }
  const textColors = document.getElementById("text-colors");
  for (const c of TEXT_COLORS) {
    const b = document.createElement("button");
    b.className = "color-dot";
    b.style.background = c;
    b.onclick = async () => {
      prefs.textColor = c;
      refreshText();
      await savePrefs();
    };
    textColors.appendChild(b);
  }
  const textSize = document.getElementById("text-size");
  textSize.value = Math.max(0, Math.min(28, prefs.textSp - 16));
  textSize.oninput = async () => {
    prefs.textSp = +textSize.value + 16;
    refreshText();
    await savePrefs();
  };

  document.getElementById("answer-input").oninput = async (e) => {
    await setKv("attempt:" + qs[index].id, e.target.value);
  };
  const handle = document.getElementById("answer-handle");
  const card = document.getElementById("answer-card");
  let drag = null;
  handle.addEventListener("pointerdown", (e) => {
    drag = { dx: e.clientX - card.offsetLeft, dy: e.clientY - card.offsetTop };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    card.style.left = Math.max(0, e.clientX - drag.dx) + "px";
    card.style.top = Math.max(0, e.clientY - drag.dy) + "px";
    card.style.right = "auto";
  });
  handle.addEventListener("pointerup", async () => {
    if (!drag) return;
    drag = null;
    await setKv("attemptX:" + qs[index].id, card.offsetLeft / window.innerWidth);
    await setKv("attemptY:" + qs[index].id, card.offsetTop / window.innerHeight);
  });

  const onWinResize = () => applyLayout();
  window.addEventListener("resize", onWinResize);
  window.addEventListener("orientationchange", onWinResize);
  boardState = { resizeAll, applyLayout };
  applyLayout();
  await show();
}

function ensureInk(doc) {
  if (!doc.zones) doc.zones = {};
  if (!doc.order) doc.order = [];
  for (const z of ["main", "A", "B", "C", "D"]) {
    if (!doc.zones[z]) doc.zones[z] = [];
  }
}

boot().catch((err) => {
  app.innerHTML = `<div class="screen"><h1>載入失敗</h1><pre>${err}</pre></div>`;
  console.error(err);
});
