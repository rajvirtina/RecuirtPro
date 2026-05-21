# Face API Models

The proctoring system uses [face-api.js](https://github.com/justadudewhohacks/face-api.js)
(TinyFaceDetector) to detect faces during AI interviews.
The model files (~190 KB) must be present in this directory.

## Download (run from `frontend/` root)

### Windows (PowerShell)

```powershell
$base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$out  = "public/models"

Invoke-WebRequest "$base/tiny_face_detector_model-weights_manifest.json" -OutFile "$out/tiny_face_detector_model-weights_manifest.json"
Invoke-WebRequest "$base/tiny_face_detector_model-shard1"                -OutFile "$out/tiny_face_detector_model-shard1"
```

### macOS / Linux (curl)

```bash
BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
curl -Lo public/models/tiny_face_detector_model-weights_manifest.json "$BASE/tiny_face_detector_model-weights_manifest.json"
curl -Lo public/models/tiny_face_detector_model-shard1                "$BASE/tiny_face_detector_model-shard1"
```

## Required files

| File | Size |
|------|------|
| `tiny_face_detector_model-weights_manifest.json` | ~1 KB |
| `tiny_face_detector_model-shard1` | ~190 KB |

## Notes

- Models are loaded only when `VITE_ENABLE_PROCTORING=true` (lazy import).
- If the models are missing, face detection is gracefully skipped —
  tab-switch, window-blur, and copy/paste detection still work.
- The `.gitignore` does **not** exclude these files, so they can be committed
  or downloaded at deploy time via the CI pipeline.
