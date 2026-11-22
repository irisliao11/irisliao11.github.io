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
function ghost(page, showRight) {
  const c = page.cloneNode(true);
  c.querySelectorAll(".flip-wrap").forEach(function (el) { el.remove(); });
  c.querySelectorAll("*").forEach(function (el) { el.style.animation = "none"; });
  Object.assign(c.style, {
    position: "absolute", top: "0", height: "100%", width: "200%",
    left: showRight ? "-100%" : "0",
    maxWidth: "none", minHeight: "0", margin: "0",
    border: "none", borderRadius: "0", boxShadow: "none",
    animation: "none", display: "block", zIndex: "auto"
  });
  return c;
}

function face(extra) {
  const f = document.createElement("div");
  Object.assign(f.style, {
    position: "absolute", inset: "0", overflow: "hidden",
    backfaceVisibility: "hidden", webkitBackfaceVisibility: "hidden",
    boxShadow: "0 0 18px rgba(0, 0, 0, 0.3)"
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
    pointerEvents: "none", zIndex: "5"
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
    duration: 800, easing: "ease-in-out", fill: "forwards"
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
      t.thawPending = true;      // show the "it's time!" card once
      thawed = true;
    }
  });

  if (thawed) {
    save();
    render();
    return;
  }

  document.querySelectorAll(".countdown").forEach(function (el) {
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
    if (!locked) {
      tabData.photos.forEach(function (photo, i) {
        const polaroid = document.createElement("div");
        polaroid.className = "polaroid";
        polaroid.style.setProperty("--i", i);


        const img = document.createElement("img");
        img.src = photo.src;


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
        const photoDel = document.createElement("button");
        photoDel.className = "photo-delete";
        photoDel.textContent = "×";
        photoDel.title = "Delete photo";
        photoDel.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!confirm("Delete this photo?")) return;
          deletePhoto(index, i);
        });


        polaroid.appendChild(img);
        polaroid.appendChild(caption);
        polaroid.appendChild(photoDel);
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
    }    if (tabData.thawPending) {
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
}

function shrinkImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      const maxSize = 600;
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
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "u") {
    state.tabs[state.active].sealedUntil = null;
    save();
    render();
  }
});
render();