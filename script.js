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

function deleteTab(index) {
  const tab = state.tabs[index];
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

function render() {
  tabList.innerHTML = "";
  pagesEl.innerHTML = "";

  state.tabs.forEach(function (tabData, index) {
    const isActive = index === state.active;

    const tab = document.createElement("div");
    tab.className = "tab" + (isActive ? " active" : "");

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tabData.name;

    const del = document.createElement("button");
    del.className = "tab-delete";
    del.textContent = "×";
    del.title = "Delete this tab";
    del.addEventListener("click", function (event) {
      event.stopPropagation();
      deleteTab(index);
    });

    tab.appendChild(label);
    tab.appendChild(del);
    tab.addEventListener("click", function () {
      state.active = index;
      save();
      render();
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
    photoInput.value = "";
    captionInput.value = "";
  });
});

newTabButton.addEventListener("click", function () {
  const name = prompt("Name this moment:", "Moment " + (state.tabs.length + 1));
  if (!name) return;
  state.tabs.push({ name: name, photos: [] });
  state.active = state.tabs.length - 1;
  save();
  render();
});

render();