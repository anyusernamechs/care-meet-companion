# Code signing and GitHub releases



This app is built with **electron-builder** (NSIS installer) and updates through **electron-updater** + **GitHub Releases**.



For **internal CARE rollout**, a **self-signed** certificate is enough. IT deploys the public `.cer` once to staff machines; after that, installs and auto-updates run without “unknown publisher” prompts.



## 1. Self-signed certificate (recommended for internal)



### Create the cert (once)



```powershell

cd "C:\Users\libin\Documents\Projects\CARE meet companion"

powershell -ExecutionPolicy Bypass -File scripts/create-selfsign-cert.ps1

```



This writes (gitignored):



- `certs/care-meet-companion-selfsign.pfx` — **secret**, for signing builds

- `certs/care-meet-companion-selfsign.cer` — **public**, give to IT



Keep the same PFX for every release. If you replace it, staff may need to trust a new cert and auto-update can break.

The certificate subject should use the legal organization name, for example:

`CN=CARE Meet Companion, O=Care Human Services`

`package.json` → `build.win.publisherName` must include that organization string (it can be a list during a rename transition).



### IT: trust the cert on staff PCs



Deploy `care-meet-companion-selfsign.cer` to **Trusted Publishers** for all Care Human Services machines.



**GPO (summary):** Computer Configuration → Windows Settings → Security Settings → Public Key Policies → Trusted Publishers → Import.



**Manual test on one PC:**



```powershell

Import-Certificate -FilePath "\\share\certs\care-meet-companion-selfsign.cer" -CertStoreLocation Cert:\LocalMachine\TrustedPublisher

```



After that, the installer shows **CARE Meet Companion** as publisher instead of “Unknown”.



### Sign a build locally



```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-signed.ps1
```

Or: `npm run package:signed` (prompts for PFX password).



Without `CSC_*` set, the build is **unsigned** (still works for dev).



### Optional: commercial certificate later



If you distribute outside IT-managed machines, buy a standard/EV code signing cert from DigiCert, Sectigo, etc. The same `CSC_LINK` / `WIN_CSC_LINK` flow applies.



## 2. Create the GitHub repository



1. Create a repo on GitHub, e.g. `carehelps-ca/care-meet-companion`.

2. Update `repository.url` in `package.json` if your org/name differs.

3. Push the project:



```powershell

git remote add github https://github.com/carehelps-ca/care-meet-companion.git

git push -u github master

```



(Replace `github` with your remote name if you already use `origin` for GitHub.)



## 3. Add GitHub Actions secrets



In the repo: **Settings → Secrets and variables → Actions → New repository secret**



| Secret | Purpose |

| --- | --- |

| `WIN_CSC_LINK` | Base64-encoded self-sign `.pfx` |

| `WIN_CSC_KEY_PASSWORD` | PFX export password |

| `GOOGLE_CLIENT_ID` | OAuth client for installed builds |

| `GOOGLE_CLIENT_SECRET` | Optional; leave empty if not used |

| `GOOGLE_API_KEY` | Drive folder picker |

| `GOOGLE_DRIVE_FOLDER_ID` | Default upload folder (optional) |

| `FIREBASE_API_KEY` | Optional metadata |

| `FIREBASE_PROJECT_ID` | Optional metadata |

| `FIREBASE_APP_ID` | Optional metadata |

| `CARE_GITHUB_UPDATE_TOKEN` | Read-only PAT for **private** repo updates (see below) |



`GITHUB_TOKEN` is provided automatically by Actions for publishing releases.



### Encode the PFX for `WIN_CSC_LINK`



```powershell

[Convert]::ToBase64String([IO.File]::ReadAllBytes("certs\care-meet-companion-selfsign.pfx")) | Set-Clipboard

```



Paste the clipboard into the `WIN_CSC_LINK` secret.



## 4. Ship a release



1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.1.1`).

2. Commit and tag:



```powershell

git add package.json package-lock.json

git commit -m "chore: release v0.1.1"

git tag v0.1.1

git push github master --tags

```



3. The **Release** workflow builds a signed installer, uploads it to GitHub Releases, and publishes `latest.yml` for auto-update.



Installed apps check for updates on startup and every 4 hours. When an update is downloaded, users see **Restart to update** in the sidebar.



## 5. Private repository updates



If the GitHub repo is **private**, installed apps need a read-only token to download releases:



1. Create a fine-grained PAT with **Contents: Read-only** on this repo.

2. Add it as `CARE_GITHUB_UPDATE_TOKEN` in GitHub Actions secrets (baked into the installer `.env`).

3. For **public** repos, leave `CARE_GITHUB_UPDATE_TOKEN` empty.



## 6. Manual publish from your PC



```powershell
$env:GH_TOKEN = "ghp_..."
powershell -ExecutionPolicy Bypass -File scripts/package-signed.ps1 -Publish
```



## Troubleshooting



| Issue | Fix |

| --- | --- |

| “Unknown publisher” on staff PCs | IT has not imported the `.cer` to Trusted Publishers |

| SmartScreen blocks download | Expected for self-sign; use internal share + trusted cert |

| `CSC_LINK` errors | Use base64 for GitHub secret; local path OK on your machine |

| Updates not found | Tag must match `v*`; version in `package.json` must increase |

| Signing skipped | `CSC_LINK` / password not set in that shell |

| Auto-update fails after new cert | Re-sign all future builds with the **original** PFX, or redeploy new `.cer` |


