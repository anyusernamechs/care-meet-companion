# CARE Meet Companion

Host-side desktop app for recording Google Meet sessions on the **meeting host's own computer**. Staff sign in with their `@carehelps.ca` Google account, open Meet from the app, record, and get a video plus automatic transcript — no command line or extra software required after install.

## For staff (end users)

1. Run **`CARE Meet Companion Setup.exe`** from your IT team (or from `release/` after a build).
2. Open **CARE Meet Companion** from the Start menu.
3. Click **Connect** and sign in with your CARE Google account.
4. Pick your meeting from **Your calendar**, then click **Open meeting in app**.
5. Click **Start Recording** when the meeting begins.
6. Click **Stop and Save** when finished.

Your recording folder opens from the link at the bottom of the app. Each meeting is saved as:

```text
Documents\CARE Meet Recordings\<Meeting title - date time>\
  <Meeting title>.mp4
  transcript.txt
```

Transcription runs automatically on your computer — nothing else to install.

## For IT (building the installer)

Requirements: Windows 10/11, Node.js 20+.

```powershell
cd "C:\Users\libin\Documents\Projects\CARE meet companion"
copy .env.example .env
# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Desktop OAuth client)
npm install
npm run package
```

`npm run package` downloads **FFmpeg**, **whisper.cpp**, and the **English base model** (~200 MB total), builds the app, and writes the installer to `release\`.

Distribute **`CARE Meet Companion Setup 0.1.0.exe`** to staff. They do not need FFmpeg, Whisper, or Node.js on their machines.

**Signed builds and auto-updates:** internal rollout uses a **self-signed** cert — see [docs/CODE_SIGNING_AND_RELEASES.md](docs/CODE_SIGNING_AND_RELEASES.md). Run `scripts/create-selfsign-cert.ps1`, have IT trust the `.cer`, then push a git tag (`v0.1.1`) to publish signed installers and updates.

Optional `.env` values (baked into the installer via `extraResources`):

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth for calendar + Drive |
| `GOOGLE_DRIVE_FOLDER_ID` | Shared Drive folder (leave empty to save locally only) |
| `CARE_GITHUB_UPDATE_TOKEN` | Read-only GitHub PAT for auto-updates (private repo only) |
| `CARE_RECORDINGS_DIR` | Override default recordings folder |
| `CARE_WHISPER_ENABLED` | `false` to skip transcripts |

Advanced overrides (`CARE_FFMPEG_PATH`, `CARE_WHISPER_PATH`, `CARE_WHISPER_MODEL_PATH`) are only needed if not using the bundled installer.

## Development

```powershell
npm run prepare-tools   # once: download bundled FFmpeg + Whisper into resources/bin
npm run dev
```

## Google Cloud setup

See [docs/GOOGLE_CLOUD_SETUP.md](docs/GOOGLE_CLOUD_SETUP.md). Project **`care-meet-recorder`** — enable Calendar + Drive APIs and create a Desktop OAuth client.

## Architecture

```text
Electron UI + embedded Meet panel
  -> MediaRecorder (WebM)
Main process
  -> FFmpeg (bundled) -> MP4
  -> whisper.cpp (bundled) -> transcript.txt
  -> optional Google Drive upload
```

## Notes

- Host-side recorder — not a Meet bot.
- Default capture: **Meet tab in app** (recommended for non-technical users).
- Recordings stay on the PC unless Drive upload is configured.
