# Neural HCI Console

AI-inspired web interface with speech recognition and emotion detection (text-based) built in Python.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 in a browser.

## Notes

- Speech recognition uses the browser Web Speech API; it works best in Chromium-based browsers.
- Emotion detection runs locally in Python using a lightweight naive Bayes model.
- Facial emotion uses `face-api.js` via CDN; the browser will request camera access.
