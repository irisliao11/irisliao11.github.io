const photoInput = document.getElementById("photo");
const captionInput = document.getElementById("caption");
const addButton = document.getElementById("add");
const board = document.getElementById("board");
const newTabButton = document.getElementById("newTab");
const tabList = document.getElementById("tabList");

let activePage = null; // the page photos get added to

// highlight one tab and show only its page
function selectTab(tab, page) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  tab.classList.add("active");
  page.classList.add("active");
  activePage = page;
}

// make a tab (name in the sidebar) + its matching page
function createTab(name) {
  const tab = document.createElement("button");
  tab.className = "tab";
  tab.textContent = name;

  const page = document.createElement("div");
  page.className = "page";
  page.appendChild(document.getElementById("pageTemplate").content.cloneNode(true));

  tab.addEventListener("click", function () {
    selectTab(tab, page);
  });

  // double-click a tab to rename it right in the sidebar
  tab.addEventListener("dblclick", function () {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tab-input";
    input.value = tab.textContent;
    tab.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function finish(save) {
      if (done) return;
      done = true;
      const newName = input.value.trim();
      if (save && newName) tab.textContent = newName;
      input.replaceWith(tab);
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", function () {
      finish(true);
    });
  });

  tabList.appendChild(tab);
  board.appendChild(page);
  selectTab(tab, page); // jump to the new tab
}

// "+ new tab": show a text box in the sidebar to type the name
newTabButton.addEventListener("click", function () {
  if (document.querySelector(".tab-input")) return; // already naming one

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tab-input";
  input.placeholder = "tab name...";
  tabList.appendChild(input);
  input.focus();

  let done = false;
  function finish(save) {
    if (done) return;
    done = true;
    const name = input.value.trim();
    input.remove();
    if (save && name) createTab(name);
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", function () {
    finish(true);
  });
});

// add a photo to the active tab
addButton.addEventListener("click", function () {
  if (!activePage) {
    alert("Make a tab first!");
    return;
  }

  const file = photoInput.files[0];

  if (!file) {
    alert("Pick a photo first!");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    const polaroid = document.createElement("div");
    polaroid.className = "polaroid";
    polaroid.style.setProperty("--i", activePage.children.length); // staggers the fade-in

    const img = document.createElement("img");
    img.src = event.target.result;

    const caption = document.createElement("p");
    caption.textContent = captionInput.value;

    polaroid.appendChild(img);
    polaroid.appendChild(caption);
    activePage.appendChild(polaroid);

    photoInput.value = "";
    captionInput.value = "";
  };

  reader.readAsDataURL(file);
});