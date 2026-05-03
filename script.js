const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 🥤 Drinks
const drinks = [];
for (let i = 1; i <= 5; i++) {
  const img = new Image();
  img.src = `drink${i}.png`;
  drinks.push(img);
}

// 🧠 State
let grabbedDrink = null;
let grabbedFromQueue = false;
let grabbedIndex = -1;

let queue = [];
let isPinching = false;

let smoothX = 0;
let smoothY = 0;

// 🔊 Sounds
const acceptSound = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");
const rejectSound = new Audio("https://www.soundjay.com/buttons/sounds/button-10.mp3");

// 🤖 MediaPipe
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

// 🔵 DRAW HAND (LINES + POINTS)
function drawHand(landmarks) {
  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
  ];

  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 15;
  ctx.shadowColor = "cyan";

  connections.forEach(([i, j]) => {
    const x1 = (1 - landmarks[i].x) * canvas.width;
    const y1 = landmarks[i].y * canvas.height;
    const x2 = (1 - landmarks[j].x) * canvas.width;
    const y2 = landmarks[j].y * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // points
  landmarks.forEach((p) => {
    const x = (1 - p.x) * canvas.width;
    const y = p.y * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "yellow";
    ctx.fill();
  });
}

// 🎯 MAIN
hands.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 🎥 Mirror camera
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  let leftHand = null;
  let rightHand = null;

  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((lm) => {
      const x = 1 - lm[0].x;
      if (x < 0.5) leftHand = lm;
      else rightHand = lm;
    });
  }

  // 🔵 DRAW HANDS (IMPORTANT)
  if (leftHand) drawHand(leftHand);
  if (rightHand) drawHand(rightHand);

  const tips = [4, 8, 12, 16, 20];

  // 🥤 Left hand drinks
  if (leftHand && grabbedDrink === null) {
    tips.forEach((tip, i) => {
      const x = (1 - leftHand[tip].x) * canvas.width;
      const y = leftHand[tip].y * canvas.height;
      ctx.drawImage(drinks[i], x - 25, y - 25, 50, 50);
    });
  }

  // 🎯 Buttons (center)
  const accept = { x: canvas.width * 0.3, y: canvas.height * 0.5 };
  const reject = { x: canvas.width * 0.7, y: canvas.height * 0.5 };

  let nearAccept = false;
  let nearReject = false;

  if (rightHand) {
    const dx = rightHand[4].x - rightHand[8].x;
    const dy = rightHand[4].y - rightHand[8].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const targetX = (1 - rightHand[8].x) * canvas.width;
    const targetY = rightHand[8].y * canvas.height;

    // smooth
    smoothX += (targetX - smoothX) * 0.25;
    smoothY += (targetY - smoothY) * 0.25;

    nearAccept = Math.hypot(smoothX - accept.x, smoothY - accept.y) < 130;
    nearReject = Math.hypot(smoothX - reject.x, smoothY - reject.y) < 130;

    // 🟢 GRAB
    if (distance < 0.08 && !isPinching) {
      isPinching = true;

      // from left hand
      if (grabbedDrink === null && leftHand) {
        tips.forEach((tip, i) => {
          const lx = leftHand[tip].x;
          const ly = leftHand[tip].y;

          if (
            Math.abs(lx - rightHand[8].x) < 0.08 &&
            Math.abs(ly - rightHand[8].y) < 0.08
          ) {
            grabbedDrink = i;
            grabbedFromQueue = false;
          }
        });
      }

      // from queue
      if (grabbedDrink === null) {
        queue.forEach((item, index) => {
          const qx = 50 + index * 70;
          const qy = canvas.height - 80;

          if (
            Math.abs(smoothX - qx) < 40 &&
            Math.abs(smoothY - qy) < 40
          ) {
            grabbedDrink = item;
            grabbedFromQueue = true;
            grabbedIndex = index;
          }
        });
      }
    }

    // 🔴 DROP
    if (distance > 0.1 && isPinching) {
      isPinching = false;

      if (grabbedDrink !== null) {

        if (nearAccept && !grabbedFromQueue) {
          queue.push(grabbedDrink);
          acceptSound.play();
        }

        if (nearReject && grabbedFromQueue) {
          queue.splice(grabbedIndex, 1);
          rejectSound.play();
        }

        grabbedDrink = null;
        grabbedFromQueue = false;
        grabbedIndex = -1;
      }
    }

    // 🎯 DRAG
    if (grabbedDrink !== null) {
      let drawX = smoothX;
      let drawY = smoothY;

      if (nearAccept) {
        drawX = accept.x;
        drawY = accept.y;
      }

      if (nearReject) {
        drawX = reject.x;
        drawY = reject.y;
      }

      ctx.drawImage(drinks[grabbedDrink], drawX - 35, drawY - 35, 70, 70);
    }
  }

  // 🎨 Buttons UI
  ctx.beginPath();
  ctx.arc(accept.x, accept.y, nearAccept ? 70 : 60, 0, 2 * Math.PI);
  ctx.fillStyle = nearAccept ? "lime" : "green";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(reject.x, reject.y, nearReject ? 70 : 60, 0, 2 * Math.PI);
  ctx.fillStyle = nearReject ? "orange" : "red";
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "40px Arial";
  ctx.fillText("✔", accept.x - 15, accept.y + 15);
  ctx.fillText("✖", reject.x - 15, reject.y + 15);

  if (nearReject) {
    ctx.font = "60px Arial";
    ctx.fillText("🗑️", reject.x - 25, reject.y - 90);
  }

  // 📦 Queue
  queue.forEach((item, i) => {
    ctx.drawImage(drinks[item], 50 + i * 70, canvas.height - 80, 60, 60);
  });
});

// 🎥 Camera
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

camera.start();