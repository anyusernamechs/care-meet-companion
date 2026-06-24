# Google Cloud setup for CARE Meet Recorder

This guide configures Google Cloud for the **host-side desktop recorder**. Users sign in with their **own Google account** and read their **personal primary calendar** — not a delegated MeetRoom resource calendar.

## Difference from MeetRoom

| | MeetRoom | CARE Meet Recorder |
| --- | --- | --- |
| Calendar source | Delegated room resource (`sasklake@carehs.ca`) | User's `primary` calendar |
| Auth | Service account + optional impersonation | User OAuth on host PC |
| Who uses it | Fixed room kiosk / assigned panel users | Any host joining their own meetings |
| Meeting list | Synced to Firestore by Cloud Functions | Read live from Calendar API after sign-in |

---

## Project created for you

A GCP project was created under the **carehelps.ca** org:

| Setting | Value |
| --- | --- |
| Project ID | `care-meet-recorder` |
| Project name | CARE Meet Recorder |
| Enabled APIs | Drive, Calendar, Chat, **Google Picker** |

Verify:

```powershell
gcloud projects describe care-meet-recorder
gcloud services list --enabled --project=care-meet-recorder
```

---

## Step 1 — OAuth consent screen (nonprofit Workspace)

1. Open [Google Cloud Console → care-meet-recorder](https://console.cloud.google.com/apis/credentials/consent?project=care-meet-recorder)
2. **User type:** Internal (recommended for carehelps.ca Workspace only)
   - If Internal is unavailable, choose External and add `@carehelps.ca` test users while in Testing
3. **App name:** `CARE Meet Recorder`
4. **User support email:** your admin email
5. **Developer contact:** your admin email
6. **Scopes → Add or remove scopes:**
   - `.../auth/userinfo.email`
   - `.../auth/calendar.readonly`
   - `.../auth/drive.file`
   - `.../auth/drive.readonly` (folder picker browsing)
   - `.../auth/drive.metadata.readonly`
7. Save

For a **Google for Nonprofits** Workspace, Internal publishing keeps the app available to all `@carehelps.ca` users without public verification.

---

## Step 2 — Create OAuth Desktop client

1. [Credentials → Create credentials → OAuth client ID](https://console.cloud.google.com/apis/credentials?project=care-meet-recorder)
2. Application type: **Desktop app**
3. Name: `CARE Meet Recorder Desktop`
4. Create and copy:
   - Client ID
   - Client secret

Add authorized redirect URI (Desktop clients usually allow loopback automatically, but confirm):

```text
http://127.0.0.1:42813/oauth2callback
```

---

## Step 2b — Drive folder picker (API key)

The in-app **Browse Drive** button uses Google's official Picker UI (search, shared drives, breadcrumbs).

1. [Enable Google Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com?project=care-meet-recorder)
2. [Credentials → Create credentials → API key](https://console.cloud.google.com/apis/credentials?project=care-meet-recorder)
3. Restrict the key to **Google Picker API** (recommended)
4. Under **Application restrictions**, choose **None** (desktop Electron app). Do not use HTTP referrer restrictions — they block the picker in this app.
5. Add to `.env`:

```env
GOOGLE_API_KEY=your_api_key_here
```

`FIREBASE_API_KEY` from the same project also works if you already have one configured.

---

## Step 3 — Shared Drive folder for recordings

1. In Google Drive, open or create a Shared Drive, e.g. **CARE Meeting Records**
2. Create subfolders if needed: `HR`, `Interviews`, `Training`, `Admin`, `IT`
3. Open the target folder in the browser. The URL looks like:

```text
https://drive.google.com/drive/folders/FOLDER_ID_HERE
```

4. Copy `FOLDER_ID_HERE` → `GOOGLE_DRIVE_FOLDER_ID` in `.env`

Each host uploads with their own Google login (`drive.file` scope). The signed-in user must have **Contributor** or higher access to that Shared Drive folder.

---

## Step 4 — Google Chat webhook (notifications)

This is the lowest-friction Chat option — no Chat app review required.

1. Open the Google Chat space where hosts should be notified (e.g. `#CARE Recordings`)
2. Space name → **Apps & integrations** → **Webhooks**
3. Create webhook, name it `CARE Meet Recorder`
4. Copy the webhook URL → `GOOGLE_CHAT_WEBHOOK_URL` in `.env`

After each upload, the app posts:

```text
CARE Meet Recorder
Recording saved to Drive. Transcript saved.

Meeting: HR Interview - June 23
Host: user@carehelps.ca
...
```

---

## Step 5 — Firebase (optional, metadata only)

Keep Firebase minimal — **do not store recordings in Firebase Storage**.

Option A — reuse existing MeetRoom Firebase project:

| Variable | Example |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `meetroom-df237` |
| `FIREBASE_API_KEY` | from Firebase console |
| `FIREBASE_APP_ID` | from Firebase console |

Option B — add Firebase to `care-meet-recorder`:

```powershell
firebase projects:addfirebase care-meet-recorder
```

Recording metadata is stored at:

```text
users/{hostEmail}/recordings/{sessionId}
```

Update Firestore rules to allow authenticated writes from your admin dashboard only (desktop app uses API key — tighten rules before production).

---

## Step 6 — Configure `.env`

```powershell
cd "C:\Users\libin\Documents\Projects\CARE meet companion"
copy .env.example .env
```

Fill in:

```env
GOOGLE_CLIENT_ID=YOUR_DESKTOP_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_DESKTOP_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://127.0.0.1:42813/oauth2callback
GOOGLE_DRIVE_FOLDER_ID=YOUR_SHARED_DRIVE_FOLDER_ID
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...

# Optional
FIREBASE_PROJECT_ID=meetroom-df237
FIREBASE_API_KEY=...
FIREBASE_APP_ID=...

CARE_NOTIFY_EMAIL=you@carehelps.ca
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

---

## Step 7 — Run the app

```powershell
npm install
npm run dev
```

First run:

1. **Connect Google Account** — grants calendar + Drive access
2. Your **personal calendar** Meet events appear in the dropdown
3. Open Meet from your calendar as usual
4. **Start Recording** → **Stop and Upload**

---

## OAuth scopes requested

| Scope | Why |
| --- | --- |
| `userinfo.email` | Identify host, Firestore path |
| `calendar.readonly` | Read user's primary calendar Meet events |
| `drive.file` | Upload MP4 + transcript to Shared Drive |

No Meet API, no Admin SDK, no domain-wide delegation required.

---

## Troubleshooting

**"Google OAuth is not configured"**  
Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

**"Could not load your calendar"**  
Reconnect Google Account after adding `calendar.readonly` scope. Delete `%APPDATA%\care-meet-companion\google-tokens.json` and sign in again.

**Drive upload permission denied**  
Host must have access to the Shared Drive folder. Check folder ID and permissions.

**Chat webhook failed**  
Verify `GOOGLE_CHAT_WEBHOOK_URL` is complete. Webhooks expire if deleted from the space.

**MeetRoom vs this app**  
MeetRoom (`meetroom-df237`) assigns users to physical rooms and syncs **resource calendars**. This app is for staff recording meetings they join from **their own calendar**.

---

## gcloud quick reference

```powershell
# Set active project
gcloud config set project care-meet-recorder

# Confirm APIs
gcloud services list --enabled --project=care-meet-recorder

# Billing (required before heavy API use)
# Link billing in Console → Billing → link care-meet-recorder to your org billing account
```
