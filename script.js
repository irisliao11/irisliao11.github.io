/* ==========================================================
   Time capsule
   ----------------------------------------------------------
   1. Config and DOM references
   2. Small helpers
   3. State and storage
   4. Polaroid layout (position, rotation, scale)
   5. Selecting, dragging, rotating, resizing
   6. Page-flip animation
   7. Sealing and the countdown
   8. Tabs
   9. Photo menu and caption editing
  10. Rendering
  11. Adding photos
  12. Event wiring and startup
   ========================================================== */


/* ---------- 1. Config and DOM references ---------- */

const STORAGE_KEY = "timeCapsule";

// default polaroid placement
const COL_X = [0.25, 0.75];   // column centers, as a fraction of board width
const FIRST_Y = 90;
const ROW_STEP = 310;

// polaroid interaction
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.1;
const DRAG_THRESHOLD = 4;     // px of movement before a press counts as a drag
const SNAP_DEGREES = 15;      // rotation snap when Shift is held

// uploaded photos
const MAX_IMAGE_SIZE = 450;
const JPEG_QUALITY = 0.75;

// page flip: a larger perspective is a weaker 3D effect, so the leaf
// doesn't grow past the page edges (and get clipped) mid-flip
const FLIP_MS = 700;
const FLIP_PERSPECTIVE = "9000px";

const photoInput = document.getElementById("photo");
const captionInput = document.getElementById("caption");
const addButton = document.getElementById("add");
const newTabButton = document.getElementById("newTab");
const tabList = document.getElementById("tabList");
const pagesEl = document.getElementById("pages");
const pageTemplate = document.getElementById("pageTemplate");
const openDateInput = document.getElementById("openDate");
const sealButton = document.getElementById("seal");


/* ---------- 2. Small helpers ---------- */

// create an element with an optional class and text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatDate(ms) {
  return new Date(ms).toLocaleString();
}

function formatLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m ${s % 60}s`;
}


/* ---------- 3. State and storage ---------- */

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.tabs && saved.tabs.length) return saved;
  } catch (e) {}
  return null;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert("Storage is full! Try smaller photos or fewer of them.");
  }
}

let state = load() || {
  active: 0,
  tabs: [{ name: "Moment 1", photos: [], sealedUntil: null }]
};

function isTabLocked(tab) {
  return !!tab.sealedUntil && Date.now() < tab.sealedUntil;
}


/* ---------- 4. Polaroid layout ---------- */

// every photo stores its own spot: { cx, y, r, s, z }
//   cx = horizontal center (fraction of board width)   y = top (px)
//   r  = rotation (deg)   s = scale   z = stacking order
function getLayout(photo, i) {
  if (!photo.layout) {
    const wave = Math.floor(i / 4);
    photo.layout = {
      cx: COL_X[i % 2] + wave * 0.03,
      y: FIRST_Y + (Math.floor(i / 2) % 2) * ROW_STEP + wave * 20,
      r: i % 2 === 0 ? -3 : 3,
      s: 1,
      z: 1
    };
  }
  return photo.layout;
}

function applyLayout(polaroid, L) {
  polaroid.style.left = (L.cx * 100) + "%";
  polaroid.style.top = L.y + "px";
  polaroid.style.zIndex = L.z;
  polaroid.style.setProperty("--s", L.s);
  polaroid.style.transform =
    `translateX(-50%) rotate(${L.r}deg) scale(${L.s})`;
}

// keep a polaroid fully inside the board
function clampLayout(polaroid, L, board) {
  const bw = board.clientWidth;
  const bh = board.clientHeight;
  if (!bw || !bh) return;

  const w = polaroid.offsetWidth;
  const h = polaroid.offsetHeight;

  const halfW = (w * L.s) / 2 + 4;
  L.cx = Math.max(halfW / bw, Math.min(1 - halfW / bw, L.cx));

  const minY = 4 - (h * (1 - L.s)) / 2;
  const maxY = bh - 4 - (h * (1 + L.s)) / 2;
  L.y = Math.max(minY, Math.min(maxY, L.y));
}

// next z-index that puts a photo on top of every other photo
function topZ() {
  let z = 1;
  state.tabs.forEach((tab) => {
    tab.photos.forEach((p) => {
      if (p.layout && p.layout.z > z) z = p.layout.z;
    });
  });
  return z + 1;
}


/* ---------- 5. Selecting, dragging, rotating, resizing ---------- */

let selectedEl = null;

function selectPolaroid(polaroid) {
  if (selectedEl && selectedEl !== polaroid) selectedEl.classList.remove("selected");
  selectedEl = polaroid;
  polaroid.classList.add("selected");
}

function deselectPolaroid() {
  if (selectedEl) selectedEl.classList.remove("selected");
  selectedEl = null;
}

// follow one pointer until it is released
function track(polaroid, startEvent, onMove, onEnd) {
  polaroid.classList.add("dragging");

  function move(e) {
    if (e.pointerId === startEvent.pointerId) onMove(e);
  }
  function up(e) {
    if (e.pointerId !== startEvent.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    polaroid.classList.remove("dragging");
    onEnd(e);
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

// press and drag the photo to move it
function enableDrag(polaroid, L) {
  polaroid.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".caption-input, .polaroid-tools, .rot-handle")) return;

    selectPolaroid(polaroid);
    L.z = topZ();
    polaroid.style.zIndex = L.z;

    const board = polaroid.parentElement;
    const boardWidth = board.clientWidth;
    const startX = e.clientX;
    const startY = e.clientY;
    const startCx = L.cx;
    const startTop = L.y;
    let moved = false;

    track(polaroid, e, (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      moved = true;
      L.cx = startCx + dx / boardWidth;
      L.y = startTop + dy;
      clampLayout(polaroid, L, board);
      applyLayout(polaroid, L);
    }, save);
  });
}

// a rotate handle on each corner (hold Shift to snap)
function addRotateHandles(polaroid, L) {
  ["tl", "tr", "bl", "br"].forEach((pos) => {
    const handle = el("div", "rot-handle " + pos);
    handle.title = "Drag to rotate (hold Shift to snap)";

    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      const r = polaroid.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      const startRot = L.r;

      track(polaroid, e, (ev) => {
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
        let rot = startRot + (angle - startAngle);
        if (ev.shiftKey) rot = Math.round(rot / SNAP_DEGREES) * SNAP_DEGREES;
        L.r = Math.round(rot * 10) / 10;
        applyLayout(polaroid, L);
      }, save);
    });

    polaroid.appendChild(handle);
  });
}

// "-" and "+" buttons under the photo
function addResizeTools(polaroid, L) {
  const tools = el("div", "polaroid-tools");

  function resize(step) {
    L.s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((L.s + step) * 100) / 100));
    clampLayout(polaroid, L, polaroid.parentElement);
    applyLayout(polaroid, L);
    save();
  }

  const minus = el("button", "", "−");
  minus.title = "Smaller";
  minus.addEventListener("click", (e) => {
    e.stopPropagation();
    resize(-SCALE_STEP);
  });

  const plus = el("button", "", "+");
  plus.title = "Bigger";
  plus.addEventListener("click", (e) => {
    e.stopPropagation();
    resize(SCALE_STEP);
  });

  tools.append(minus, plus);
  polaroid.appendChild(tools);
}

function makeInteractive(polaroid, L) {
  enableDrag(polaroid, L);
  addRotateHandles(polaroid, L);
  addResizeTools(polaroid, L);
}


/* ---------- 6. Page-flip animation ---------- */

// a static copy of a page, used as one face of the turning leaf
// (showRight = show the page's right half, otherwise its left half)
function ghost(page, showRight) {
  const c = page.cloneNode(true);
  c.style.setProperty("--ghost", "1");
  c.querySelectorAll(".flip-wrap").forEach((node) => node.remove());
  c.querySelectorAll("*").forEach((node) => { node.style.animation = "none"; });

  // blur is expensive to animate, so the copies use a flat frosted color
  c.querySelectorAll(".page-lock").forEach((node) => {
    node.style.backdropFilter = "none";
    node.style.webkitBackdropFilter = "none";
    node.style.background = "rgba(226, 241, 252, 0.97)";
  });

  c.querySelectorAll(".rot-handle, .polaroid-tools").forEach((node) => node.remove());
  c.querySelectorAll(".polaroid").forEach((p) => {
    p.classList.remove("selected", "dragging");
    p.style.transition = "none";
    p.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
  });

  Object.assign(c.style, {
    position: "absolute", top: "0", left: showRight ? "-100%" : "0",
    width: "200%", height: "100%",
    maxWidth: "none", minHeight: "0", maxHeight: "none", margin: "0",
    boxSizing: "border-box",
    border: "none", borderRadius: "0", boxShadow: "none",
    animation: "none", display: "block", zIndex: "auto",
    overflow: "hidden"
  });
  return c;
}

// one side of the leaf
function face(extra) {
  const f = el("div");
  Object.assign(f.style, {
    position: "absolute", inset: "0", overflow: "hidden",
    backfaceVisibility: "hidden", webkitBackfaceVisibility: "hidden",
    boxShadow: "0 0 8px rgba(0, 0, 0, 0.25)"
  }, extra);
  return f;
}

function flip(oldPage, backward) {
  const newPage = pagesEl.querySelector(".page.active");
  if (!oldPage || !newPage) return;

  // don't replay the photo entrance animation under the flip
  newPage.querySelectorAll(".polaroid").forEach((p) => {
    p.style.animation = "none";
  });

  const wrap = el("div", "flip-wrap");
  Object.assign(wrap.style, {
    position: "absolute", inset: "0", perspective: FLIP_PERSPECTIVE,
    pointerEvents: "none", zIndex: "100000"
  });

  // the half of the old page that stays put while the leaf turns
  const cover = el("div");
  Object.assign(cover.style, {
    position: "absolute", top: "0", bottom: "0",
    width: "50%", overflow: "hidden",
    left: backward ? "50%" : "0"
  });
  cover.appendChild(ghost(oldPage, backward));

  // the leaf, hinged at the spine
  const leaf = el("div");
  Object.assign(leaf.style, {
    position: "absolute", top: "0", bottom: "0", left: "50%", width: "50%",
    transformOrigin: "left center", transformStyle: "preserve-3d",
    willChange: "transform"
  });

  const [frontPage, backPage] = backward ? [newPage, oldPage] : [oldPage, newPage];
  const front = face();
  const back = face({ transform: "rotateY(180deg)" });
  front.appendChild(ghost(frontPage, true));
  back.appendChild(ghost(backPage, false));

  leaf.append(front, back);
  wrap.append(cover, leaf);
  newPage.appendChild(wrap);

  const flat = "rotateY(0deg)";
  const turned = "rotateY(-180deg)";
  const [from, to] = backward ? [turned, flat] : [flat, turned];

  const anim = leaf.animate(
    [{ transform: from }, { transform: to }],
    { duration: FLIP_MS, easing: "ease-in-out", fill: "forwards" }
  );
  anim.onfinish = () => wrap.remove();
}


/* ---------- 7. Sealing and the countdown ---------- */

// every second: unlock tabs whose time has come, update countdowns
function tick() {
  const now = Date.now();
  let thawed = false;

  state.tabs.forEach((t) => {
    if (t.sealedUntil && now >= t.sealedUntil) {
      t.sealedUntil = null;
      t.thawPending = true;
      thawed = true;
    }
  });

  if (thawed) {
    save();
    render();
    return;
  }

  document.querySelectorAll(".page > .page-lock .countdown").forEach((node) => {
    node.textContent = formatLeft(Number(node.dataset.until) - now);
  });
}

function sealActiveTab() {
  const tab = state.tabs[state.active];

  if (isTabLocked(tab)) {
    alert(`"${tab.name}" is already sealed.`);
    return;
  }
  if (!openDateInput.value) {
    alert("Pick an open date first!");
    return;
  }
  const when = new Date(openDateInput.value).getTime();
  if (when <= Date.now()) {
    alert("Pick a date in the future!");
    return;
  }
  if (!confirm(`Seal "${tab.name}" until ${formatDate(when)}? ` +
               "You won't be able to change it until then.")) return;

  tab.sealedUntil = when;
  tab.thawPending = false;
  save();
  render();
}


/* ---------- 8. Tabs ---------- */

function deleteTab(index) {
  const tab = state.tabs[index];

  if (isTabLocked(tab)) {
    alert(`"${tab.name}" is sealed until ${formatDate(tab.sealedUntil)}, so it can't be deleted.`);
    return;
  }
  if (state.tabs.length === 1) {
    alert("You need at least one tab!");
    return;
  }

  const count = tab.photos.length;
  const warning = count > 0
    ? `Delete "${tab.name}" and its ${count} photo(s)? This can't be undone.`
    : `Delete "${tab.name}"?`;
  if (!confirm(warning)) return;

  state.tabs.splice(index, 1);
  if (state.active >= state.tabs.length) {
    state.active = state.tabs.length - 1;
  } else if (index < state.active) {
    state.active -= 1;
  }
  save();
  render();
}

function renameTab(index) {
  const name = prompt("Rename this moment:", state.tabs[index].name);
  if (name === null || name.trim() === "") return;
  state.tabs[index].name = name.trim();
  save();
  render();
}

function addTab() {
  const name = prompt("Name this moment:", "Moment " + (state.tabs.length + 1));
  if (!name) return;
  const oldPage = pagesEl.querySelector(".page.active");
  state.tabs.push({ name: name, photos: [], sealedUntil: null });
  state.active = state.tabs.length - 1;
  save();
  render();
  flip(oldPage);
}


/* ---------- 9. Photo menu and caption editing ---------- */

let menu = null;

function closeMenu() {
  if (menu) {
    menu.remove();
    menu = null;
  }
}

function deletePhoto(tabIndex, photoIndex) {
  if (isTabLocked(state.tabs[tabIndex])) return;
  state.tabs[tabIndex].photos.splice(photoIndex, 1);
  save();
  render();
  // stop the remaining photos from replaying their entrance animation
  document.querySelectorAll(".polaroid").forEach((p) => {
    p.style.animation = "none";
  });
}

function editCaption(captionEl, tabIndex, photoIndex) {
  const photo = state.tabs[tabIndex].photos[photoIndex];

  const input = el("input", "caption-input");
  input.type = "text";
  input.value = photo.caption;
  captionEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  function finish(saveIt) {
    if (done) return;
    done = true;
    if (saveIt) {
      photo.caption = input.value;
      captionEl.textContent = photo.caption;
      save();
    }
    input.replaceWith(captionEl);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

// right-click menu for a photo
function showMenu(x, y, tabIndex, photoIndex, captionEl) {
  closeMenu();

  menu = el("div", "photo-menu");

  const editBtn = el("button", "", "edit description");
  editBtn.addEventListener("click", () => {
    closeMenu();
    editCaption(captionEl, tabIndex, photoIndex);
  });

  const deleteBtn = el("button", "danger", "delete photo");
  deleteBtn.addEventListener("click", () => {
    closeMenu();
    if (!confirm("Delete this photo?")) return;
    deletePhoto(tabIndex, photoIndex);
  });

  menu.append(editBtn, deleteBtn);
  document.body.appendChild(menu);

  // keep the menu on screen
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";
}


/* ---------- 10. Rendering ---------- */

function buildTab(tabData, index) {
  const tab = el("div", "tab" + (index === state.active ? " active" : ""));
  tab.title = "Double-click to rename";

  const label = el("span", "tab-label", tabData.name);
  if (isTabLocked(tabData)) label.prepend(el("span", "tab-lock", "🔒"));

  const edit = el("button", "tab-edit", "✎");
  edit.title = "Rename this tab";
  edit.addEventListener("click", (e) => {
    e.stopPropagation();
    renameTab(index);
  });

  const del = el("button", "tab-delete", "×");
  del.title = "Delete this tab";
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTab(index);
  });

  tab.append(label, edit, del);

  tab.addEventListener("click", () => {
    if (state.active === index) return;
    const oldPage = pagesEl.querySelector(".page.active");
    const backward = index < state.active;
    state.active = index;
    save();
    render();
    flip(oldPage, backward);
  });
  tab.addEventListener("dblclick", () => renameTab(index));

  return tab;
}

function buildPolaroid(photo, tabIndex, photoIndex) {
  const L = getLayout(photo, photoIndex);

  const polaroid = el("div", "polaroid");
  polaroid.style.setProperty("--i", photoIndex);   // staggers the entrance animation
  polaroid._L = L;
  applyLayout(polaroid, L);

  const img = el("img");
  img.src = photo.src;
  img.draggable = false;

  const caption = el("p", "", photo.caption);
  polaroid.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMenu(e.clientX, e.clientY, tabIndex, photoIndex, caption);
  });
  caption.addEventListener("dblclick", () => {
    editCaption(caption, tabIndex, photoIndex);
  });

  polaroid.append(img, caption);
  makeInteractive(polaroid, L);
  return polaroid;
}

// "frozen" overlay with a live countdown
function buildLockCover(tabData) {
  const n = tabData.photos.length;
  const cover = el("div", "page-lock");
  cover.innerHTML =
    '<div class="lock-card">' +
      "<h2>frozen</h2>" +
      "<p>this moment opens on<br><strong></strong></p>" +
      `<p>${n} photo${n === 1 ? "" : "s"} inside</p>` +
      '<div class="countdown"></div>' +
    "</div>";
  cover.querySelector("strong").textContent = formatDate(tabData.sealedUntil);

  const countdown = cover.querySelector(".countdown");
  countdown.dataset.until = tabData.sealedUntil;
  countdown.textContent = formatLeft(tabData.sealedUntil - Date.now());
  return cover;
}

// "it's time!" overlay shown once a sealed tab unlocks
function buildThawCover(tabData) {
  const cover = el("div", "page-lock");
  cover.innerHTML =
    '<div class="lock-card">' +
      "<h2>it's time!</h2>" +
      "<p>this moment has thawed.<br>see what you froze.</p>" +
      "<button>open this moment</button>" +
    "</div>";
  cover.querySelector("button").addEventListener("click", () => {
    tabData.thawPending = false;
    save();
    render();
  });
  return cover;
}

function buildPage(tabData, index) {
  const locked = isTabLocked(tabData);

  const page = el("div", "page" + (index === state.active ? " active" : ""));
  page.appendChild(pageTemplate.content.cloneNode(true));
  page.querySelector("h2").textContent = tabData.name;

  // every photo gets a saved spot, even while the tab is sealed
  tabData.photos.forEach((photo, i) => getLayout(photo, i));

  const board = el("div", "board");
  if (!locked) {
    tabData.photos.forEach((photo, i) => {
      board.appendChild(buildPolaroid(photo, index, i));
    });
  }
  page.appendChild(board);

  if (locked) page.appendChild(buildLockCover(tabData));
  if (tabData.thawPending) page.appendChild(buildThawCover(tabData));

  return page;
}

function render() {
  selectedEl = null;
  tabList.innerHTML = "";
  pagesEl.innerHTML = "";

  state.tabs.forEach((tabData, index) => {
    tabList.appendChild(buildTab(tabData, index));
    pagesEl.appendChild(buildPage(tabData, index));
  });

  // now that the page is on screen, make sure every photo fits inside it
  document.querySelectorAll(".page.active .polaroid").forEach((p) => {
    if (!p._L) return;
    clampLayout(p, p._L, p.parentElement);
    applyLayout(p, p._L);
  });
}


/* ---------- 11. Adding photos ---------- */

// downscale a photo so it fits comfortably in localStorage
function shrinkImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      callback(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function addPhoto() {
  const tab = state.tabs[state.active];
  if (isTabLocked(tab)) {
    alert(`"${tab.name}" is sealed until ${formatDate(tab.sealedUntil)}. ` +
          "Switch to another tab to add photos.");
    return;
  }

  const file = photoInput.files[0];
  if (!file) {
    alert("Pick a photo first!");
    return;
  }

  shrinkImage(file, (dataUrl) => {
    tab.photos.push({ src: dataUrl, caption: captionInput.value });
    save();
    render();
    captionInput.value = "";
  });
}


/* ---------- 12. Event wiring and startup ---------- */

addButton.addEventListener("click", addPhoto);
newTabButton.addEventListener("click", addTab);
sealButton.addEventListener("click", sealActiveTab);

// clicking anywhere that isn't a photo deselects it
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".polaroid")) deselectPolaroid();
});

// close the right-click menu
document.addEventListener("click", closeMenu);
document.addEventListener("contextmenu", closeMenu);
window.addEventListener("scroll", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

setInterval(tick, 1000);
render();