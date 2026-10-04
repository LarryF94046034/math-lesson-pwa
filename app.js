import { getKv, setKv, inkKey, mentorInkKey, clearAllInk } from "./db.js";
import { DrawBoard, ZoomImage } from "./draw.js";
import { initCloud, cloudReady, cloudStatus, fetchMentorInk, publishMentorInk } from "./cloud.js";
import { isFirebaseConfigured } from "./firebase-config.js";

const ASSET_BASE = new URL("./", import.meta.url);
const INK_RESET_MARK = "ink-reset-v12";
const TEACHER_PASSWORD = "larry1997";
const MENTOR_AUTH_KEY = "mentorAuth";

function asset(path) {
  return new URL(path.replace(/^\.\//, ""), ASSET_BASE).href;
}
const COLORS = ["#c62828", "#1565c0", "#212121", "#2e7d32", "#ef6c00", "#6a1b9a"];
const TEXT_COLORS = ["#212121", "#1565c0", "#c62828", "#2e7d32"];

const app = document.getElementById("app");
let data = null;
let prefs = null;
let favorites = [];
let boardState = null;

function isMentorAuthed() {
  return sessionStorage.getItem(MENTOR_AUTH_KEY) === "1";
}

function setMentorAuthed(on) {
  if (on) sessionStorage.setItem(MENTOR_AUTH_KEY, "1");
  else sessionStorage.removeItem(MENTOR_AUTH_KEY);
}

function promptMentorLogin() {
  const pw = prompt("請輸入導師密碼");
  if (pw == null) return false;
  if (pw === TEACHER_PASSWORD) {
    setMentorAuthed(true);
    return true;
  }
  alert("密碼錯誤");
  return false;
}

async function boot() {
  const res = await fetch(asset("data/questions.json"));
  if (!res.ok) throw new Error("questions.json " + res.status);
  data = await res.json();
  // One-time wipe of mis-mapped strokes from older soft-rotate builds.
  if (localStorage.getItem("inkReset") !== INK_RESET_MARK) {
    await clearAllInk();
    localStorage.setItem("inkReset", INK_RESET_MARK);
  }
  prefs = (await getKv("prefs")) || {
    penPx: 6,
    eraserPx: 28,
    color: COLORS[0],
    textSp: 22,
    textColor: TEXT_COLORS[0],
  };
  favorites = (await getKv("favorites")) || [];
  initCloud();
  renderHome();
}

async function savePrefs() {
  await setKv("prefs", prefs);
}

function questionsOf(zone) {
  return data.questions[zone] || [];
}

function renderHome() {
  boardState = null;
  const mentorOn = isMentorAuthed();
  const cloudOk = cloudReady();
  app.innerHTML = `
  <div class="screen">
    <div class="muted">國中數學 1 上　教用　網頁版／PWA</div>
    <div class="h1">數學教案</div>
    <div class="muted">範圍 1-1～1-4　學生作答存在這支手機；導師四區發佈到雲端供全班看</div>

    <div class="h2">導師四區　全班看同一份板書</div>
    <div class="muted" id="mentor-status"></div>
    <div class="row" style="margin-bottom:8px">
      <button class="primary" id="btn-mentor-auth">${mentorOn ? "導師已登入　點此登出" : "導師登入"}</button>
    </div>
    <div class="row" id="zones-mentor"></div>

    <div class="h2">四區題目　講義</div>
    <div class="row" id="zones-lecture"></div>

    <div class="h2">四區作答　答案先遮住</div>
    <div class="row" id="zones-practice"></div>

    <div class="h2">收藏的題目</div>
    <div class="fav-list" id="fav-list"></div>

    <p class="muted">離線可用：講義／作答畫筆存在本機。導師四區需連線；換題時自動發佈。</p>
    <p class="muted">版號 v15　若不是此版，請用 Chrome 開啟；Facebook 內建瀏覽器常卡舊快取。</p>
  </div>`;

  const status = document.getElementById("mentor-status");
  if (!isFirebaseConfigured()) {
    status.textContent = "導師雲端尚未設定：請在 firebase-config.js 填入 Firebase 專案設定，並建立 Firestore。";
  } else if (!cloudOk) {
    status.textContent = cloudStatus();
  } else {
    status.textContent = mentorOn
      ? "導師模式：可編輯導師四區，換題／返回時自動發佈到雲端。"
      : "學生模式：可看導師已發佈的板書（唯讀）。講義／作答仍可自己畫。";
  }

  document.getElementById("btn-mentor-auth").onclick = () => {
    if (isMentorAuthed()) {
      setMentorAuthed(false);
      renderHome();
      return;
    }
    if (promptMentorLogin()) renderHome();
  };

  const lec = document.getElementById("zones-lecture");
  const pra = document.getElementById("zones-practice");
  const men = document.getElementById("zones-mentor");
  for (const z of data.zones) {
    lec.appendChild(zoneBtn(z, false, false));
    pra.appendChild(zoneBtn(z, true, false));
    men.appendChild(zoneBtn(z, false, true));
  }
  renderFavorites();
}

function zoneBtn(z, practice, mentor) {
  const b = document.createElement("button");
  if (mentor) {
    b.textContent = `導師　${z.title}\n${z.pages}`;
  } else {
    b.textContent = `${practice ? z.title + "作答" : z.title}\n${z.pages}`;
  }
  b.style.whiteSpace = "pre-line";
  b.onclick = () => renderZone(z.id, practice, mentor);
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

async function renderZone(zoneId, practice, mentor = false) {
  const z = data.zones.find((x) => x.id === zoneId);
  const qs = questionsOf(zoneId);
  const resultsOn = !mentor && practice && (await getKv("results:" + zoneId, false));
  const mentorEdit = mentor && isMentorAuthed();
  let modeLabel = practice ? "作答　答案先遮住" : "講義";
  if (mentor) {
    modeLabel = mentorEdit
      ? "導師板書　可編輯　換題自動發佈"
      : "導師板書　唯讀（看老師發佈內容）";
  }
  let html = `
  <div class="screen">
    <button id="back-home">← 回首頁</button>
    <div class="h1">${mentor ? "導師　" : ""}${z.title}　${z.pages}</div>
    <div class="muted">${modeLabel}</div>
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
    b.onclick = () => openBoard(zoneId, i, practice, mentor);
    if (!mentor) {
      const star = document.createElement("button");
      const fav = isFav(zoneId, i, practice);
      star.textContent = fav ? "已收藏" : "收藏";
      star.style.flex = "0 0 88px";
      star.onclick = async () => {
        await toggleFav(zoneId, i, practice);
        renderZone(zoneId, practice, mentor);
      };
      row.appendChild(b);
      row.appendChild(star);
    } else {
      row.appendChild(b);
    }
    list.appendChild(row);
  }
  if (!mentor && practice) {
    const result = document.createElement("button");
    result.className = "primary";
    result.textContent = resultsOn ? "隱藏結果" : "結果";
    result.onclick = async () => {
      await setKv("results:" + zoneId, !resultsOn);
      renderZone(zoneId, practice, mentor);
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

async function loadInkForBoard(questionId, practice, mentor, mentorEdit) {
  if (mentor) {
    if (mentorEdit) {
      const local = await getKv(mentorInkKey(questionId));
      if (local) return local;
      try {
        return (await fetchMentorInk(questionId)) || { zones: {}, order: [] };
      } catch (err) {
        console.warn(err);
        return { zones: {}, order: [] };
      }
    }
    try {
      return (await fetchMentorInk(questionId)) || { zones: {}, order: [] };
    } catch (err) {
      console.warn(err);
      return { zones: {}, order: [] };
    }
  }
  return (await getKv(inkKey(questionId, practice))) || { zones: {}, order: [] };
}

async function saveInkLocal(questionId, practice, mentor, inkDoc) {
  if (mentor) await setKv(mentorInkKey(questionId), inkDoc);
  else await setKv(inkKey(questionId, practice), inkDoc);
}

async function openBoard(zoneId, index, practice, mentor = false) {
  const qs = questionsOf(zoneId);
  const z = data.zones.find((x) => x.id === zoneId);
  const mentorEdit = mentor && isMentorAuthed();
  const readOnly = mentor && !mentorEdit;
  let reveal = mentor ? true : !practice;
  let inkDoc = await loadInkForBoard(qs[index].id, practice, mentor, mentorEdit);
  ensureInk(inkDoc);

  app.innerHTML = `
  <div class="board layout-landscape" id="board" data-rot="0">
    <div class="board-rotator" id="board-rotator">
      <div class="board-top">
        <button id="btn-back">返回</button>
        <div class="board-title" id="board-title"></div>
        <span class="tool-label">字</span>
        <input class="seek" type="range" id="text-size" min="0" max="28" />
        <span id="text-colors"></span>
        <button id="btn-fav" ${mentor ? 'style="display:none"' : ""}>收藏</button>
        <button id="btn-solution" style="display:none">解答</button>
        <button id="btn-prev">上一題</button>
        <button id="btn-next">下一題</button>
      </div>
      <div class="board-tools" id="board-tools" ${readOnly ? 'style="display:none"' : ""}>
        <button id="btn-draw">繪圖</button>
        <button id="btn-clear">清除本題</button>
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
  let publishBusy = false;

  async function publishCurrent(reason = "") {
    if (!mentor || !mentorEdit) return;
    if (!cloudReady()) {
      console.warn("skip publish: cloud not ready", reason);
      return;
    }
    if (publishBusy) return;
    publishBusy = true;
    try {
      await publishMentorInk(qs[index].id, inkDoc);
      const el = document.getElementById("board-status");
      if (el) el.textContent = (el.textContent || "") + "　已發佈";
    } catch (err) {
      console.warn(err);
      alert("發佈失敗：" + (err?.message || err));
    } finally {
      publishBusy = false;
    }
  }

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
          if (readOnly) return;
          if (!inkDoc.zones[zone]) inkDoc.zones[zone] = [];
          inkDoc.zones[zone].push(stroke);
          inkDoc.order.push(zone);
          marked = zone;
          await saveInkLocal(q.id, practice, mentor, inkDoc);
          refreshMarks();
          updateStatus();
        },
      });
      board.setStrokes(inkDoc.zones[zone] || []);
      board.setStyle(prefs);
      board.setTool(readOnly ? "none" : tool);
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

  function applyLayout() {
    const board = document.getElementById("board");
    const rotator = document.getElementById("board-rotator");
    if (!board || !rotator) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Question board is always landscape; soft-rotate when the phone is upright.
    const softLandscape = vh > vw;

    board.classList.add("layout-landscape");
    board.classList.remove("layout-portrait");
    board.classList.toggle("rot-90", softLandscape);
    board.classList.remove("rot-neg90", "rot-180");
    board.dataset.rot = softLandscape ? "90" : "0";

    if (softLandscape) {
      rotator.style.position = "absolute";
      rotator.style.width = vh + "px";
      rotator.style.height = vw + "px";
      rotator.style.top = "50%";
      rotator.style.left = "50%";
      rotator.style.right = "auto";
      rotator.style.bottom = "auto";
      rotator.style.transform = "translate(-50%, -50%) rotate(90deg)";
      rotator.style.transformOrigin = "center center";
    } else {
      rotator.style.position = "absolute";
      rotator.style.width = "";
      rotator.style.height = "";
      rotator.style.top = "0";
      rotator.style.left = "0";
      rotator.style.right = "0";
      rotator.style.bottom = "0";
      rotator.style.transform = "";
      rotator.style.transformOrigin = "";
    }

    requestAnimationFrame(() => {
      resizeAll();
      requestAnimationFrame(resizeAll);
    });
  }

  function updateStatus() {
    const q = qs[index];
    const mode = readOnly
      ? "唯讀"
      : tool === "pen"
        ? "繪圖開"
        : tool === "eraser"
          ? "橡皮擦開"
          : "瀏覽";
    const shape = q.kind === "choice" ? "右半邊四格" : "右半邊一整區";
    const total = Object.values(inkDoc.zones).reduce((n, a) => n + a.length, 0);
    const who = mentor ? (mentorEdit ? "導師編輯" : "導師示範") : practice ? "作答" : "講義";
    document.getElementById("board-status").textContent =
      `${who}　${shape}　${mode}　已存 ${total} 筆` +
      (marked ? `　上一筆在 ${marked === "main" ? "作答區" : marked}` : "");
  }

  async function show() {
    const q = qs[index];
    inkDoc = await loadInkForBoard(q.id, practice, mentor, mentorEdit);
    ensureInk(inkDoc);
    marked = inkDoc.order.length ? inkDoc.order[inkDoc.order.length - 1] : "";
    const head = mentor ? (mentorEdit ? "導師編輯" : "導師示範") : practice ? "作答" : "講義";
    document.getElementById("board-title").textContent =
      `${head}　${z.title}　第 ${q.page} 頁　${q.label}`;
    document.getElementById("btn-prev").disabled = index <= 0;
    document.getElementById("btn-next").disabled = index >= qs.length - 1;
    const favBtn = document.getElementById("btn-fav");
    if (favBtn && !mentor) {
      favBtn.textContent = isFav(zoneId, index, practice) ? "已收藏" : "收藏";
    }
    const sol = document.getElementById("btn-solution");
    const card = document.getElementById("answer-card");
    if (!mentor && practice) {
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
    if (!mentor && practice && !reveal) {
      await zoom.setSrc(coverCanvas(img));
    } else {
      await zoom.setSrc(src);
    }
  }

  document.getElementById("btn-back").onclick = async () => {
    await publishCurrent("back");
    window.removeEventListener("resize", onWinResize);
    window.removeEventListener("orientationchange", onWinResize);
    renderZone(zoneId, practice, mentor);
  };
  document.getElementById("btn-prev").onclick = async () => {
    if (index <= 0) return;
    await publishCurrent("prev");
    index--;
    await show();
  };
  document.getElementById("btn-next").onclick = async () => {
    if (index + 1 >= qs.length) {
      await publishCurrent("next-end");
      return;
    }
    await publishCurrent("next");
    index++;
    await show();
  };
  const favBtn = document.getElementById("btn-fav");
  if (favBtn && !mentor) {
    favBtn.onclick = async () => {
      await toggleFav(zoneId, index, practice);
      favBtn.textContent = isFav(zoneId, index, practice) ? "已收藏" : "收藏";
    };
  }
  document.getElementById("btn-solution").onclick = async () => {
    reveal = !reveal;
    document.getElementById("btn-solution").textContent = reveal ? "隱藏解答" : "解答";
    refreshText();
    await loadImage(qs[index]);
  };
  if (!readOnly) {
    document.getElementById("btn-draw").onclick = () => setTool(tool === "pen" ? "none" : "pen");
    document.getElementById("btn-eraser").onclick = () => setTool(tool === "eraser" ? "none" : "eraser");
    document.getElementById("btn-clear").onclick = async () => {
      if (!confirm("清除這一題的全部筆跡？")) return;
      inkDoc = { zones: {}, order: [] };
      ensureInk(inkDoc);
      marked = "";
      await saveInkLocal(qs[index].id, practice, mentor, inkDoc);
      if (mentor && mentorEdit) await publishCurrent("clear");
      for (const d of draws) d.board.clear();
      refreshMarks();
      updateStatus();
    };
  }

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
  applyLayout();
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
