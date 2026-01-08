const micButton = document.getElementById("micButton");
const stopButton = document.getElementById("stopButton");
const analyzeButton = document.getElementById("analyzeButton");
const textInput = document.getElementById("textInput");
const emotionLabel = document.getElementById("emotionLabel");
const emotionBars = document.getElementById("emotionBars");
const statusValue = document.getElementById("statusValue");
const history = document.getElementById("history");

let recognition = null;
const historyItems = [];

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
  emotionBars.innerHTML = "";
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
      emotionBars.appendChild(row);
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
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unknown error");
    }

    emotionLabel.textContent = data.label;
    updateBars(data.scores);
    updateVisuals(data.label);
    updateHistory(data.label, text);
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
