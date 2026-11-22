const STORAGE_KEY = "timeCapsule";

const photoInput = document.getElementById("photo");
const captionInput = document.getElementById("caption");
const addButton = document.getElementById("add");
const newTabButton = document.getElementById("newTab");
const tabList = document.getElementById("tabList");
const pagesEl = document.getElementById("pages");
const pageTemplate = document.getElementById("pageTemplate");
const openDateInput = document.getElementById("openDate");
const sealButton = document.getElementById("seal");

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
delete state.sealedUntil;

const COL_X = [0.25, 0.75];
const FIRST_Y = 90;
const ROW_STEP = 310;

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

function applyLayout(el, L) {
  el.style.left = (L.cx * 100) + "%";
  el.style.top = L.y + "px";
  el.style.zIndex = L.z;
  el.style.setProperty("--s", L.s);
  el.style.transform =
    "translateX(-50%) rotate(" + L.r + "deg) scale(" + L.s + ")";
}
function clampLayout(el, L, board) {
  const bw = board.clientWidth;
  const bh = board.clientHeight;
  if (!bw || !bh) return;

  const w = el.offsetWidth;
  const h = el.offsetHeight;

  const halfW = (w * L.s) / 2 + 4;
  L.cx = Math.max(halfW / bw, Math.min(1 - halfW / bw, L.cx));

  const minY = 4 - (h * (1 - L.s)) / 2;
  const maxY = bh - 4 - (h * (1 + L.s)) / 2;
  L.y = Math.max(minY, Math.min(maxY, L.y));
}
function topZ() {
  let z = 1;
  state.tabs.forEach(function (t) {
    t.photos.forEach(function (p) {
      if (p.layout && p.layout.z > z) z = p.layout.z;
    });
  });
  return z + 1;
}

let selectedEl = null;

function selectPolaroid(el) {
  if (selectedEl && selectedEl !== el) selectedEl.classList.remove("selected");
  selectedEl = el;
  el.classList.add("selected");
}

function deselectPolaroid() {
  if (selectedEl) selectedEl.classList.remove("selected");
  selectedEl = null;
}

document.addEventListener("pointerdown", function (e) {
  if (!e.target.closest(".polaroid")) deselectPolaroid();
});

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
function makeInteractive(polaroid, L) {

  // drag the photo to move it
  polaroid.addEventListener("pointerdown", function (e) {
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

    track(polaroid, e, function (ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;   // ignore tiny wobbles
      moved = true;
      L.cx = startCx + dx / boardWidth;
      L.y = startTop + dy;
      clampLayout(polaroid, L, board);
      applyLayout(polaroid, L);
    }, save);
  });

  ["tl", "tr", "bl", "br"].forEach(function (pos) {
    const handle = document.createElement("div");
    handle.className = "rot-handle " + pos;
    handle.title = "Drag to rotate (hold Shift to snap)";

    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      const r = polaroid.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      const startRot = L.r;

      track(polaroid, e, function (ev) {
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
        let rot = startRot + (angle - startAngle);
        if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
        L.r = Math.round(rot * 10) / 10;
        applyLayout(polaroid, L);
      }, save);
    });

    polaroid.appendChild(handle);
  });

  const tools = document.createElement("div");
  tools.className = "polaroid-tools";

  const minus = document.createElement("button");
  minus.textContent = "−";
  minus.title = "Smaller";

  const plus = document.createElement("button");
  plus.textContent = "+";
  plus.title = "Bigger";

  function resize(step) {
    L.s = Math.min(2.5, Math.max(0.4, Math.round((L.s + step) * 100) / 100));
    clampLayout(polaroid, L, polaroid.parentElement);
    applyLayout(polaroid, L);
    save();
  }
  minus.addEventListener("click", function (e) {
    e.stopPropagation();
    resize(-0.1);
  });
  plus.addEventListener("click", function (e) {
    e.stopPropagation();
    resize(0.1);
  });

  tools.append(minus, plus);
  polaroid.appendChild(tools);
}

function ghost(page, showRight) {
  const c = page.cloneNode(true);
  c.style.setProperty("--ghost", "1");
  c.querySelectorAll(".flip-wrap").forEach(function (el) { el.remove(); });
  c.querySelectorAll("*").forEach(function (el) { el.style.animation = "none"; });

  // blur is expensive to animate, so the copies use a flat frosted color
  c.querySelectorAll(".page-lock").forEach(function (el) {
    el.style.backdropFilter = "none";
    el.style.webkitBackdropFilter = "none";
    el.style.background = "rgba(226, 241, 252, 0.97)";
  });

  c.querySelectorAll(".rot-handle, .polaroid-tools").forEach(function (el) {
    el.remove();
  });
  c.querySelectorAll(".polaroid").forEach(function (p) {
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

function face(extra) {
  const f = document.createElement("div");
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

  newPage.querySelectorAll(".polaroid").forEach(function (p) {
    p.style.animation = "none";
  });

  const wrap = document.createElement("div");
  wrap.className = "flip-wrap";
  Object.assign(wrap.style, {
    position: "absolute", inset: "0", perspective: "3000px",
    pointerEvents: "none", zIndex: "100000"
  });

  const cover = document.createElement("div");
  Object.assign(cover.style, {
    position: "absolute", top: "0", bottom: "0",
    width: "50%", overflow: "hidden"
  });
  if (backward) {
    cover.style.left = "50%";
    cover.appendChild(ghost(oldPage, true));
  } else {
    cover.style.left = "0";
    cover.appendChild(ghost(oldPage, false));
  }

  const leaf = document.createElement("div");
  Object.assign(leaf.style, {
    position: "absolute", top: "0", bottom: "0", left: "50%", width: "50%",
    transformOrigin: "left center", transformStyle: "preserve-3d"
  });
  leaf.style.willChange = "transform";

  const front = face();
  const back = face({ transform: "rotateY(180deg)" });
  if (backward) {
    front.appendChild(ghost(newPage, true));
    back.appendChild(ghost(oldPage, false));
  } else {
    front.appendChild(ghost(oldPage, true));
    back.appendChild(ghost(newPage, false));
  }

  leaf.append(front, back);
  wrap.append(cover, leaf);
  newPage.appendChild(wrap);

  const frames = backward
    ? [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }]
    : [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }];

  const anim = leaf.animate(frames, {
    duration: 700, easing: "ease-in-out", fill: "forwards"
  });
  anim.onfinish = function () { wrap.remove(); };
}

function isTabLocked(tab) {
  return !!tab.sealedUntil && Date.now() < tab.sealedUntil;
}

function formatLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d + "d " + h + "h " + m + "m " + (s % 60) + "s";
}

function tick() {
  const now = Date.now();
  let thawed = false;

  state.tabs.forEach(function (t) {
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

  document.querySelectorAll(".page > .page-lock .countdown").forEach(function (el) {
    el.textContent = formatLeft(Number(el.dataset.until) - now);
  });
}
setInterval(tick, 1000);

sealButton.addEventListener("click", function () {
  const tab = state.tabs[state.active];

  if (isTabLocked(tab)) {
    alert('"' + tab.name + '" is already sealed.');
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
  if (!confirm('Seal "' + tab.name + '" until ' + new Date(when).toLocaleString() +
               "? You won't be able to change it until then.")) return;

  tab.sealedUntil = when;
  tab.thawPending = false;
  save();
  render();
});

function deleteTab(index) {
  const tab = state.tabs[index];

  if (isTabLocked(tab)) {
    alert('"' + tab.name + '" is sealed until ' +
          new Date(tab.sealedUntil).toLocaleString() + ", so it can't be deleted.");
    return;
  }
  if (state.tabs.length === 1) {
    alert("You need at least one tab!");
    return;
  }

  const count = tab.photos.length;
  const warning = count > 0
    ? 'Delete "' + tab.name + '" and its ' + count + " photo(s)? This can't be undone."
    : 'Delete "' + tab.name + '"?';
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
  const current = state.tabs[index].name;
  const name = prompt("Rename this moment:", current);
  if (name === null || name.trim() === "") return;
  state.tabs[index].name = name.trim();
  save();
  render();
}

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
  document.querySelectorAll(".polaroid").forEach(function (p) {
    p.style.animation = "none";
  });
}

function showMenu(x, y, tabIndex, photoIndex, captionEl) {
  closeMenu();

  menu = document.createElement("div");
  menu.className = "photo-menu";

  const editBtn = document.createElement("button");
  editBtn.textContent = "edit description";
  editBtn.addEventListener("click", function () {
    closeMenu();
    editCaption(captionEl, tabIndex, photoIndex);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "danger";
  deleteBtn.textContent = "delete photo";
  deleteBtn.addEventListener("click", function () {
    closeMenu();
    if (!confirm("Delete this photo?")) return;
    deletePhoto(tabIndex, photoIndex);
  });

  menu.append(editBtn, deleteBtn);
  document.body.appendChild(menu);

  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";
}

function editCaption(captionEl, tabIndex, photoIndex) {
  const photo = state.tabs[tabIndex].photos[photoIndex];

  const input = document.createElement("input");
  input.type = "text";
  input.className = "caption-input";
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

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", function () {
    finish(true);
  });
}

document.addEventListener("click", closeMenu);
document.addEventListener("contextmenu", closeMenu);
window.addEventListener("scroll", closeMenu);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeMenu();
});

function render() {
  selectedEl = null;
  tabList.innerHTML = "";
  pagesEl.innerHTML = "";

  state.tabs.forEach(function (tabData, index) {
    const isActive = index === state.active;
    const locked = isTabLocked(tabData);

    const tab = document.createElement("div");
    tab.className = "tab" + (isActive ? " active" : "");
    tab.title = "Double-click to rename";

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tabData.name;
    if (locked) {
      const lockIcon = document.createElement("span");
      lockIcon.className = "tab-lock";
      lockIcon.textContent = "🔒";
      label.prepend(lockIcon);
    }

    const edit = document.createElement("button");
    edit.className = "tab-edit";
    edit.textContent = "✎";
    edit.title = "Rename this tab";
    edit.addEventListener("click", function (event) {
      event.stopPropagation();
      renameTab(index);
    });

    const del = document.createElement("button");
    del.className = "tab-delete";
    del.textContent = "×";
    del.title = "Delete this tab";
    del.addEventListener("click", function (event) {
      event.stopPropagation();
      deleteTab(index);
    });

    tab.appendChild(label);
    tab.appendChild(edit);
    tab.appendChild(del);

    tab.addEventListener("click", function () {
      if (state.active === index) return;
      const oldPage = pagesEl.querySelector(".page.active");
      const backward = index < state.active;
      state.active = index;
      save();
      render();
      flip(oldPage, backward);
    });
    tab.addEventListener("dblclick", function () {
      renameTab(index);
    });
    tabList.appendChild(tab);


    const page = document.createElement("div");
    page.className = "page" + (isActive ? " active" : "");
    page.appendChild(pageTemplate.content.cloneNode(true));
    page.querySelector("h2").textContent = tabData.name;


    const board = document.createElement("div");
    board.className = "board";

    // every photo gets a saved spot
    tabData.photos.forEach(function (photo, i) {
      getLayout(photo, i);
    });
    if (!locked) {
      tabData.photos.forEach(function (photo, i) {
        const L = photo.layout;

        const polaroid = document.createElement("div");
        polaroid.className = "polaroid";
        polaroid.style.setProperty("--i", i);
        polaroid._L = L;
        applyLayout(polaroid, L);


        const img = document.createElement("img");
        img.src = photo.src;
        img.draggable = false;

        const caption = document.createElement("p");
        caption.textContent = photo.caption;
        polaroid.addEventListener("contextmenu", function (e) {
          e.preventDefault();
          e.stopPropagation();
          showMenu(e.clientX, e.clientY, index, i, caption);
        });
        caption.addEventListener("dblclick", function () {
          editCaption(caption, index, i);
        });


        polaroid.appendChild(img);
        polaroid.appendChild(caption);
        makeInteractive(polaroid, L);
        board.appendChild(polaroid);
      });
    }

    page.appendChild(board);
    if (locked) {
      const n = tabData.photos.length;
      const cover = document.createElement("div");
      cover.className = "page-lock";
      cover.innerHTML =
        '<div class="lock-card">' +
          "<h2>frozen</h2>" +
          "<p>this moment opens on<br><strong></strong></p>" +
          "<p>" + n + " photo" + (n === 1 ? "" : "s") + " inside</p>" +
          '<div class="countdown"></div>' +
        "</div>";
      cover.querySelector("strong").textContent =
        new Date(tabData.sealedUntil).toLocaleString();
      const cd = cover.querySelector(".countdown");
      cd.dataset.until = tabData.sealedUntil;
      cd.textContent = formatLeft(tabData.sealedUntil - Date.now());
      page.appendChild(cover);
    }
    if (tabData.thawPending) {
      const cover = document.createElement("div");
      cover.className = "page-lock";
      cover.innerHTML =
        '<div class="lock-card">' +
          "<h2>it's time!</h2>" +
          "<p>this moment has thawed.<br>see what you froze.</p>" +
          "<button>open this moment</button>" +
        "</div>";
      cover.querySelector("button").addEventListener("click", function () {
        tabData.thawPending = false;
        save();
        render();
      });
      page.appendChild(cover);
    }

    pagesEl.appendChild(page);
  });
  document.querySelectorAll(".page.active .polaroid").forEach(function (p) {
    if (!p._L) return;
    clampLayout(p, p._L, p.parentElement);
    applyLayout(p, p._L);
  });
}

function shrinkImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      const maxSize = 450;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);


      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);


      callback(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}


addButton.addEventListener("click", function () {
  const tab = state.tabs[state.active];
  if (isTabLocked(tab)) {
    alert('"' + tab.name + '" is sealed until ' +
          new Date(tab.sealedUntil).toLocaleString() +
          ". Switch to another tab to add photos.");
    return;
  }

  const file = photoInput.files[0];
  if (!file) {
    alert("Pick a photo first!");
    return;
  }

  shrinkImage(file, function (dataUrl) {
    tab.photos.push({
      src: dataUrl,
      caption: captionInput.value
    });
    save();
    render();
    captionInput.value = "";
  });
});
newTabButton.addEventListener("click", function () {
  const name = prompt("Name this moment:", "Moment " + (state.tabs.length + 1));
  if (!name) return;
  const oldPage = pagesEl.querySelector(".page.active");
  state.tabs.push({ name: name, photos: [], sealedUntil: null });
  state.active = state.tabs.length - 1;
  save();
  render();
  flip(oldPage);
});

render();