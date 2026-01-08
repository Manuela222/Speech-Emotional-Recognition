const micButton = document.getElementById("micButton");
const stopButton = document.getElementById("stopButton");
const analyzeButton = document.getElementById("analyzeButton");
const textInput = document.getElementById("textInput");
const emotionLabel = document.getElementById("emotionLabel");
const emotionBars = document.getElementById("emotionBars");
const textLabel = document.getElementById("textLabel");
const faceLabelMini = document.getElementById("faceLabelMini");
const statusValue = document.getElementById("statusValue");
const history = document.getElementById("history");
const cameraButton = document.getElementById("cameraButton");
const cameraStopButton = document.getElementById("cameraStopButton");
const video = document.getElementById("video");
const faceStatus = document.getElementById("faceStatus");
const faceLabel = document.getElementById("faceLabel");
const faceBars = document.getElementById("faceBars");

let recognition = null;
const historyItems = [];
let faceScores = {};
let faceInterval = null;
let modelsReady = false;

const FACE_MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

const emotionColors = {
  joy: "#83f7b0",
  sadness: "#8aa7ff",
  anger: "#ff9a8b",
  fear: "#f2c94c",
  surprise: "#7dd3fc",
  neutral: "#9aa4c7",
};

function supportsSpeechRecognition() {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => {
    statusValue.textContent = "Listening";
    micButton.disabled = true;
    stopButton.disabled = false;
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    textInput.value = transcript.trim();
  };

  recognition.onerror = () => {
    statusValue.textContent = "Mic error";
    micButton.disabled = false;
    stopButton.disabled = true;
  };

  recognition.onend = () => {
    statusValue.textContent = "Idle";
    micButton.disabled = false;
    stopButton.disabled = true;
  };
}

function updateBars(scores) {
  renderBars(emotionBars, scores);
}

function renderBars(container, scores) {
  container.innerHTML = "";
  Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "bar";
      const name = document.createElement("span");
      name.textContent = label;
      const meter = document.createElement("div");
      const fill = document.createElement("i");
      fill.style.width = `${Math.round(value * 100)}%`;
      fill.style.background = `linear-gradient(120deg, ${emotionColors[label] || "#72f0f6"}, #5cc0ff)`;
      meter.appendChild(fill);
      row.appendChild(name);
      row.appendChild(meter);
      container.appendChild(row);
    });
}

function updateVisuals(label) {
  const color = emotionColors[label] || "#72f0f6";
  document.documentElement.style.setProperty("--accent", color);
}

function updateHistory(label, text) {
  historyItems.unshift({ label, text: text.slice(0, 80) });
  historyItems.splice(5);
  history.innerHTML = "";
  historyItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `<strong>${item.label}</strong><span>${item.text}</span>`;
    history.appendChild(row);
  });
}

async function analyzeText() {
  const text = textInput.value.trim();
  if (!text) {
    statusValue.textContent = "Awaiting input";
    return;
  }

  statusValue.textContent = "Analyzing";

  try {
    const response = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, face_scores: faceScores }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unknown error");
    }

    emotionLabel.textContent = data.fused_label;
    updateBars(data.fused_scores);
    updateVisuals(data.fused_label);
    textLabel.textContent = data.text_label;
    faceLabelMini.textContent = data.face_label || "Unavailable";
    updateHistory(data.fused_label, text);
    statusValue.textContent = "Adaptive mode";
  } catch (error) {
    statusValue.textContent = "Error";
  }
}

micButton.addEventListener("click", () => {
  if (!supportsSpeechRecognition()) {
    statusValue.textContent = "Speech API unavailable";
    return;
  }
  if (!recognition) {
    setupRecognition();
  }
  recognition.start();
});

stopButton.addEventListener("click", () => {
  if (recognition) {
    recognition.stop();
  }
});

analyzeButton.addEventListener("click", analyzeText);

textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    analyzeText();
  }
});

if (!supportsSpeechRecognition()) {
  statusValue.textContent = "Speech API unavailable";
}

async function loadFaceModels() {
  if (modelsReady || !window.faceapi) {
    return;
  }
  faceStatus.textContent = "Loading models";
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(FACE_MODEL_URL),
    ]);
    modelsReady = true;
    faceStatus.textContent = "Camera ready";
  } catch (error) {
    faceStatus.textContent = "Model load failed";
  }
}

function mapExpressions(expressions) {
  const mapped = {
    anger: (expressions.angry || 0) + (expressions.disgusted || 0),
    fear: expressions.fearful || 0,
    joy: expressions.happy || 0,
    sadness: expressions.sad || 0,
    surprise: expressions.surprised || 0,
    neutral: expressions.neutral || 0,
  };
  const total = Object.values(mapped).reduce((sum, value) => sum + value, 0) || 1;
  Object.keys(mapped).forEach((key) => {
    mapped[key] = Number((mapped[key] / total).toFixed(4));
  });
  return mapped;
}

async function detectFace() {
  if (!modelsReady || video.readyState < 2) {
    return;
  }
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceExpressions();
  if (!detection) {
    faceStatus.textContent = "No face detected";
    faceScores = {};
    faceLabel.textContent = "Unavailable";
    faceLabelMini.textContent = "Unavailable";
    faceBars.innerHTML = "";
    return;
  }
  faceStatus.textContent = "Face detected";
  faceScores = mapExpressions(detection.expressions);
  const topLabel = Object.keys(faceScores).reduce((best, label) => {
    return faceScores[label] > faceScores[best] ? label : best;
  }, "neutral");
  faceLabel.textContent = topLabel;
  faceLabelMini.textContent = topLabel;
  renderBars(faceBars, faceScores);
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    faceStatus.textContent = "Camera unavailable";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    cameraButton.disabled = true;
    cameraStopButton.disabled = false;
    faceStatus.textContent = "Starting camera";
    await loadFaceModels();
    if (faceInterval) {
      clearInterval(faceInterval);
    }
    faceInterval = setInterval(detectFace, 900);
  } catch (error) {
    faceStatus.textContent = "Camera blocked";
  }
}

function stopCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
  if (faceInterval) {
    clearInterval(faceInterval);
    faceInterval = null;
  }
  faceScores = {};
  faceBars.innerHTML = "";
  faceLabel.textContent = "Neutral";
  faceLabelMini.textContent = "Neutral";
  cameraButton.disabled = false;
  cameraStopButton.disabled = true;
  faceStatus.textContent = "Camera idle";
}

cameraButton.addEventListener("click", () => {
  if (!window.faceapi) {
    faceStatus.textContent = "Face API unavailable";
    return;
  }
  startCamera();
});

cameraStopButton.addEventListener("click", stopCamera);
