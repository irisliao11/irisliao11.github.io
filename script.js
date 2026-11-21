const photoInput = document.getElementById("photo");
const captionInput = document.getElementById("caption");
const addButton = document.getElementById("add");
const board = document.getElementById("board");

addButton.addEventListener("click", function () {
    const file = photoInput.files[0];

    if (!file) {
        alert("Pick a photo first!");
        return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
        const polaroid = document.createElement("div");
        polaroid.className = "polaroid";

        const img = document.createElement("img");
        img.src = event.target.result;

        const caption = document.createElement("p");
        caption.textContent = captionInput.value;

        polaroid.appendChild(img);
        polaroid.appendChild(caption);
        board.appendChild(polaroid);

        photoInput.value = "";
        captionInput.value = "";
    };
    reader.readAsDataURL(file);
});