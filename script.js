const STORAGE_KEY = "timeCapsule";

const photoInput = document.getElementById("photo");
const captionInput = document.getElementById("caption");
const addButton = document.getElementById("add");
const newTabButton = document.getElementById("newTab");
const tabList = document.getElementById("tabList");
const pagesEl = document.getElementById("pages");
const pageTemplate = document.getElementById("pageTemplate");

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
  tabs: [{ name: "Moment 1", photos: [] }]
};

// ---------- page flip (new) ----------

// copy of a page, sized so only its left or right half shows inside a half-width box
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

// one side of the turning page
function face(extra) {
  const f = document.createElement("div");
  Object.assign(f.style, {
    position: "absolute", inset: "0", overflow: "hidden",
    backfaceVisibility: "hidden", webkitBackfaceVisibility: "hidden",
    boxShadow: "0 0 18px rgba(0, 0, 0, 0.3)"
  }, extra);
  return f;
}

// turns the old page's right side over to reveal the new page
function flip(oldPage) {
  const newPage = pagesEl.querySelector(".page.active");
  if (!oldPage || !newPage) return;

  // stop the new page's photos from animating in while the flip plays
  newPage.querySelectorAll(".polaroid").forEach(function (p) {
    p.style.animation = "none";
  });

  const wrap = document.createElement("div");
  wrap.className = "flip-wrap";
  Object.assign(wrap.style, {
    position: "absolute", inset: "0", perspective: "3000px",
    pointerEvents: "none", zIndex: "5"
  });

  // the old left side stays in place until the turning page lands on it
  const leftCover = document.createElement("div");
  Object.assign(leftCover.style, {
    position: "absolute", top: "0", bottom: "0", left: "0",
    width: "50%", overflow: "hidden"
  });
  leftCover.appendChild(ghost(oldPage, false));

  const leaf = document.createElement("div");
  Object.assign(leaf.style, {
    position: "absolute", top: "0", bottom: "0", left: "50%", width: "50%",
    transformOrigin: "left center", transformStyle: "preserve-3d"
  });

  const front = face();                              
  front.appendChild(ghost(oldPage, true));

  const back = face({ transform: "rotateY(180deg)" }); 
  back.appendChild(ghost(newPage, false));

  leaf.append(front, back);
  wrap.append(leftCover, leaf);
  newPage.appendChild(wrap);

  const anim = leaf.animate(
    [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }],
    { duration: 800, easing: "ease-in-out", fill: "forwards" }
  );
  anim.onfinish = function () { wrap.remove(); };
}

// ---------- your code ----------

function render() {
  tabList.innerHTML = "";
  pagesEl.innerHTML = "";

  state.tabs.forEach(function (tabData, index) {
    const isActive = index === state.active;

    const tab = document.createElement("button");
    tab.className = "tab" + (isActive ? " active" : "");
    tab.textContent = tabData.name;
    tab.addEventListener("click", function () {
      if (state.active === index) return;                     
      const oldPage = pagesEl.querySelector(".page.active");  
      state.active = index;
      save();
      render();
      flip(oldPage);                                        
    });
    tabList.appendChild(tab);

    const page = document.createElement("div");
    page.className = "page" + (isActive ? " active" : "");
    page.appendChild(pageTemplate.content.cloneNode(true));
    page.querySelector("h2").textContent = tabData.name;

    const board = document.createElement("div");
    board.className = "board";

    tabData.photos.forEach(function (photo, i) {
      const polaroid = document.createElement("div");
      polaroid.className = "polaroid";
      polaroid.style.setProperty("--i", i);

      const img = document.createElement("img");
      img.src = photo.src;

      const caption = document.createElement("p");
      caption.textContent = photo.caption;

      polaroid.appendChild(img);
      polaroid.appendChild(caption);
      board.appendChild(polaroid);
    });

    page.appendChild(board);
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
  const file = photoInput.files[0];
  if (!file) {
    alert("Pick a photo first!");
    return;
  }

  shrinkImage(file, function (dataUrl) {
    state.tabs[state.active].photos.push({
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
  state.tabs.push({ name: name, photos: [] });
  state.active = state.tabs.length - 1;
  save();
  render();
  flip(oldPage);                                       
});

render();