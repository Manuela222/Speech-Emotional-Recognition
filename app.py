from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from math import log
import re
from typing import Dict, List, Tuple

from flask import Flask, jsonify, render_template, request


app = Flask(__name__)


@dataclass
class EmotionModel:
    labels: List[str]
    word_counts: Dict[str, Counter]
    label_counts: Counter
    vocab: set
    total_docs: int

    def predict(self, text: str) -> Tuple[str, Dict[str, float]]:
        tokens = tokenize(text)
        if not tokens:
            return "neutral", {label: 0.0 for label in self.labels}

        scores = {}
        vocab_size = max(len(self.vocab), 1)
        for label in self.labels:
            label_docs = self.label_counts[label]
            log_prob = log((label_docs + 1) / (self.total_docs + len(self.labels)))
            total_words = sum(self.word_counts[label].values()) + vocab_size
            for token in tokens:
                token_count = self.word_counts[label][token] + 1
                log_prob += log(token_count / total_words)
            scores[label] = log_prob

        best_label = max(scores, key=scores.get)
        normalized = softmax(scores)
        return best_label, normalized


def tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def softmax(scores: Dict[str, float]) -> Dict[str, float]:
    max_logit = max(scores.values())
    exp_scores = {k: pow(2.718281828, v - max_logit) for k, v in scores.items()}
    total = sum(exp_scores.values())
    return {k: round(v / total, 4) for k, v in exp_scores.items()}


def train_model() -> EmotionModel:
    seed_data = {
        "joy": [
            "I feel amazing and full of energy",
            "This makes me so happy and proud",
            "I am excited about the future",
            "What a joyful moment",
            "I love this so much",
        ],
        "sadness": [
            "I feel down and empty",
            "This is heartbreaking",
            "I miss you and feel lonely",
            "I am tired of everything",
            "My heart feels heavy",
        ],
        "anger": [
            "I am furious about this",
            "This is unacceptable and rude",
            "I feel angry and betrayed",
            "Stop ignoring me",
            "That was a terrible decision",
        ],
        "fear": [
            "I am scared and worried",
            "This makes me anxious",
            "I am afraid of what might happen",
            "My heart is racing",
            "I feel uneasy and tense",
        ],
        "surprise": [
            "I did not see that coming",
            "Wow that is unexpected",
            "This caught me off guard",
            "I am shocked",
            "That was surprising",
        ],
        "neutral": [
            "I am working on the task",
            "The meeting is at noon",
            "I will send the report",
            "Noted and understood",
            "I am reviewing the details",
        ],
    }

    labels = list(seed_data.keys())
    word_counts = defaultdict(Counter)
    label_counts = Counter()
    vocab = set()
    total_docs = 0

    for label, texts in seed_data.items():
        for text in texts:
            tokens = tokenize(text)
            vocab.update(tokens)
            word_counts[label].update(tokens)
            label_counts[label] += 1
            total_docs += 1

    return EmotionModel(
        labels=labels,
        word_counts=word_counts,
        label_counts=label_counts,
        vocab=vocab,
        total_docs=total_docs,
    )


MODEL = train_model()


@app.route("/")
def terms() -> str:
    return render_template("terms.html")


@app.route("/app")
def index() -> str:
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze() -> tuple:
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided."}), 400

    text_label, text_scores = MODEL.predict(text)
    face_scores = payload.get("face_scores") or {}
    face_label = None
    if isinstance(face_scores, dict) and face_scores:
        face_label = max(face_scores, key=face_scores.get)
    fused_scores = fuse_scores(text_scores, face_scores)
    fused_label = max(fused_scores, key=fused_scores.get)

    return jsonify(
        {
            "text_label": text_label,
            "text_scores": text_scores,
            "face_label": face_label,
            "face_scores": face_scores,
            "fused_label": fused_label,
            "fused_scores": fused_scores,
        }
    )


def fuse_scores(
    text_scores: Dict[str, float], face_scores: Dict[str, float]
) -> Dict[str, float]:
    weights = {"text": 0.6, "face": 0.4}
    fused = {}
    for label in text_scores:
        text_value = text_scores.get(label, 0.0)
        face_value = 0.0
        if isinstance(face_scores, dict):
            face_value = float(face_scores.get(label, 0.0))
        fused[label] = round(text_value * weights["text"] + face_value * weights["face"], 4)
    return fused


if __name__ == "__main__":
    app.run(debug=True)
