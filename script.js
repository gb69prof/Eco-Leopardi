
const leopardiImg = document.getElementById("leopardi-img");
const videoContainer = document.getElementById("video-container");
const leopardiContainer = document.getElementById("leopardi-container");
const sceneContainer = document.getElementById("scene-container");

leopardiImg.addEventListener("click", () => {
    leopardiContainer.classList.add("hidden");
    videoContainer.classList.remove("hidden");
});

// Simulated transition after video (10 sec demo fallback)
setTimeout(() => {
    if (!videoContainer.classList.contains("hidden")) {
        videoContainer.classList.add("hidden");
        sceneContainer.classList.remove("hidden");
    }
}, 10000);

// Keyboard controls (PC)
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") console.log("Avanti");
    if (e.key === "ArrowLeft") console.log("Indietro");
});
