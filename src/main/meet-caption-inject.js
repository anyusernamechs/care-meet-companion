/* Injected into the Meet BrowserView — reads Google's live captions with speaker names. */
;(function () {
  if (window.__careMeetCaptions) return

  const STABILITY_TICKS = 2

  const state = {
    finalized: [],
    speaker: '',
    text: '',
    stableTicks: 0,
    lastSignature: '',
    seen: new Set(),
    committedScrollback: new Set(),
    speakerNamesAttempted: false,
    capturing: false,
    observer: null,
    lastDiagAt: 0
  }

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim()
  }

  function isProfileImg(img) {
    if (!img || img.tagName !== 'IMG') return false
    const src = (img.getAttribute('src') || '').trim()
    return src.length > 0 && (src.startsWith('http') || src.startsWith('data:'))
  }

  function looksLikeIconLigature(text) {
    if (!text) return true
    const t = text.trim()
    if (!t) return true
    if (/^[a-z0-9_]+$/.test(t) && t.length < 40) return true
    return false
  }

  function isIconName(text) {
    return looksLikeIconLigature(text)
  }

  function isMeetChromeLine(text) {
    const t = normalize(text)
    if (!t) return true
    return (
      /returning to home screen/i.test(t) ||
      /\d+\s*seconds?\s*left/i.test(t) ||
      /left in \d+/i.test(t) ||
      /you left the meeting/i.test(t) ||
      /rejoin the meeting/i.test(t) ||
      /thanks for joining/i.test(t) ||
      /meeting has ended/i.test(t) ||
      /return to home screen/i.test(t)
    )
  }

  function stripSpeakerPrefixFromText(speaker, text) {
    const s = normalize(speaker)
    let t = normalize(text)
    if (!t) return ''
    if (!s || /^participant$/i.test(s)) return t
    if (t.toLowerCase().startsWith(s.toLowerCase())) {
      t = t.slice(s.length).trim()
    }
    return t
  }

  function looksLikeCaptionLine(text) {
    if (!text) return false
    const t = text.trim()
    if (t.length < 2) return false
    if (isMeetChromeLine(t)) return false
    if (looksLikeIconLigature(t)) return false
    if (t.length < 20 && !/\s/.test(t)) {
      if (/^(bye[\w-]*|hi|hello|hey|ok|okay|yes|no|thanks|thank you)[-!.,?]*$/i.test(t)) return true
      if (/^[a-z0-9][a-z0-9'.-]*$/i.test(t) && t.length >= 2) return true
      return false
    }
    if (/\b[a-z]+_[a-z]+\b/.test(t)) return false
    if (
      /Your meeting is safe|Your meeting's ready|Copy link|Meeting details|Add people|Add others|Jump to bottom|Jump to most recent/i.test(
        t
      )
    ) {
      return false
    }
    return true
  }

  function looksLikeSpeaker(text) {
    if (!text || text.length > 48) return false
    if (looksLikeIconLigature(text)) return false
    if (/^you$/i.test(text)) return true
    if (/^(participant|speaker|unknown)$/i.test(text)) return false
    if (/:/.test(text)) return false
    return true
  }

  function resolveSpeaker(speaker) {
    const clean = normalize(speaker)
    if (!clean || /^unknown$/i.test(clean)) return 'Participant'
    if (/^you$/i.test(clean)) return 'You'
    if (clean && looksLikeSpeaker(clean)) return clean
    return 'Participant'
  }

  function parseInlineColon(text) {
    const clean = normalize(text)
    if (!clean) return null
    const match = clean.match(/^([^:]{1,48}):\s*(.+)$/)
    if (!match) return null
    const body = normalize(match[2])
    if (!body || looksLikeIconLigature(body)) return null
    return { speaker: resolveSpeaker(match[1]), text: body }
  }

  function rowSpeaker(row) {
    if (!row || !row.querySelector) return ''

    try {
      const img = row.querySelector('img[alt]')
      if (img) {
        const alt = (img.getAttribute('alt') || '').trim()
        if (alt && alt.length > 1 && !looksLikeIconLigature(alt) && !/^avatar$/i.test(alt)) {
          return alt
        }
      }

      const self = row.querySelector('[data-self-name]')
      if (self) {
        const name = (self.getAttribute('data-self-name') || '').trim()
        if (name) return name
      }

      const spans = row.querySelectorAll('span')
      for (let i = 0; i < spans.length; i += 1) {
        const t = normalize(spans[i].textContent)
        if (!t) continue
        if (looksLikeIconLigature(t)) continue
        if (t.length > 40) continue
        return t
      }
    } catch (_) {
      // ignore
    }

    return ''
  }

  function rowText(row) {
    if (!row) return ''

    try {
      const speaker = rowSpeaker(row)
      const full = normalize(row.textContent)
      if (!full) return ''

      const spans = row.querySelectorAll('span')
      let prefix = ''
      for (let i = 0; i < spans.length; i += 1) {
        const t = normalize(spans[i].textContent)
        if (t) {
          prefix = t
          break
        }
      }

      let stripped = full
      if (prefix && full.toLowerCase().startsWith(prefix.toLowerCase())) {
        stripped = full.slice(prefix.length).trim()
      }
      stripped = stripSpeakerPrefixFromText(speaker, stripped)
      stripped = stripped.replace(/\s*arrow_downward\s*Jump to bottom\s*$/i, '').trim()
      if (stripped && looksLikeCaptionLine(stripped)) return stripped

      const inline = parseInlineColon(full)
      if (inline) {
        const body = stripSpeakerPrefixFromText(inline.speaker, inline.text)
        if (body && looksLikeCaptionLine(body)) return body
      }

      const fromFull = stripSpeakerPrefixFromText(speaker, full)
      if (fromFull && looksLikeCaptionLine(fromFull)) return fromFull
    } catch (_) {
      return normalize(row.textContent)
    }

    return ''
  }

  function scoreCaptionRegion(el) {
    if (!el) return 0

    try {
      const imgs = el.querySelectorAll('img[alt]')
      const selves = el.querySelectorAll('[data-self-name]')
      const spans = el.querySelectorAll('span')
      let plausible = 0

      for (let i = 0; i < imgs.length; i += 1) {
        const alt = (imgs[i].getAttribute('alt') || '').trim()
        if (!alt || alt.length < 2) continue
        if (looksLikeIconLigature(alt)) continue
        if (/^avatar$/i.test(alt)) continue
        plausible += 1
      }

      for (let i = 0; i < selves.length; i += 1) {
        const name = (selves[i].getAttribute('data-self-name') || '').trim()
        if (name) plausible += 1
      }

      const text = normalize(el.textContent)
      if (text.length >= 8 && el.children.length > 0) {
        return Math.max(plausible * 10 + spans.length, 12)
      }

      if (plausible === 0) return 0
      if (spans.length < 2) return 0
      return plausible * 10 + spans.length
    } catch (_) {
      return 0
    }
  }

  function findCaptionRegion() {
    const exact =
      document.querySelector('[role="region"][aria-label="Captions"]') ||
      document.querySelector('[role="region"][aria-label="Live captions"]')
    if (exact) return exact

    try {
      const labelled = document.querySelectorAll('[role="region"][aria-label],[aria-label]')
      for (let i = 0; i < labelled.length; i += 1) {
        const lbl = (labelled[i].getAttribute('aria-label') || '').trim()
        if (/^(captions|live captions|sous-titres|untertitel|leyendas|字幕)$/i.test(lbl)) {
          return labelled[i]
        }
      }
    } catch (_) {
      // ignore
    }

    const primary = document.querySelector('[jsname="tgaKEf"]')
    if (primary && scoreCaptionRegion(primary) > 0) return primary
    if (primary && primary.children.length > 0 && normalize(primary.textContent).length > 3) {
      return primary
    }

    const selectors = [
      '[role="region"][aria-label*="caption" i]',
      '[data-caption-window]'
    ]
    for (const selector of selectors) {
      const node = document.querySelector(selector)
      if (node) return node
    }

    const candidates = []
    try {
      const labelled = document.querySelectorAll('[aria-label]')
      for (let i = 0; i < labelled.length; i += 1) {
        const label = labelled[i].getAttribute('aria-label') || ''
        if (/caption|sous-titre|untertitel|leyenda|字幕/i.test(label)) {
          candidates.push(labelled[i])
        }
      }
      const live = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
      for (let i = 0; i < live.length; i += 1) {
        candidates.push(live[i])
      }
    } catch (_) {
      // ignore
    }

    let best = null
    let bestScore = -1
    for (let i = 0; i < candidates.length; i += 1) {
      const score = scoreCaptionRegion(candidates[i])
      if (score > bestScore) {
        bestScore = score
        best = candidates[i]
      }
    }

    if (best) return best

    const liveRegions = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
    for (const node of liveRegions) {
      const text = normalize(node.textContent)
      if (text.length < 2 || text.length >= 8000) continue
      const rect = node.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 8) continue
      if (parseInlineColon(text) || looksLikeCaptionLine(text)) return node
    }

    return null
  }

  function finalizeCaptionRow(speaker, text) {
    const cleanSpeaker = resolveSpeaker(speaker)
    const cleanText = stripSpeakerPrefixFromText(cleanSpeaker, normalize(text))
    if (!cleanText || !looksLikeCaptionLine(cleanText) || isMeetChromeLine(cleanText)) return null
    return { speaker: cleanSpeaker, text: cleanText }
  }

  function parseCaptionRowByPattern(rowWrapper) {
    if (!rowWrapper || !rowWrapper.querySelector) return null
    const img = rowWrapper.querySelector('img')
    if (!img || !isProfileImg(img)) return null

    const speakerDiv = img.nextElementSibling
    const transcriptDiv = img.parentElement && img.parentElement.nextElementSibling
    if (!transcriptDiv) return null

    const text = normalize(transcriptDiv.textContent)
    if (!text) return null

    const speaker = speakerDiv ? normalize(speakerDiv.textContent) : ''
    return finalizeCaptionRow(speaker, text)
  }

  function parseListItem(block) {
    const childRow = { speaker: rowSpeaker(block), text: rowText(block) }
    const fromChild = finalizeCaptionRow(childRow.speaker, childRow.text)
    if (fromChild) return fromChild

    const aria = block.getAttribute('aria-label') || ''
    const saidMatch = aria.match(/^(.+?)\s+said[,:]?\s*(.+)$/i)
    if (saidMatch) {
      const row = finalizeCaptionRow(saidMatch[1], saidMatch[2])
      if (row) return row
    }

    const colonMatch = aria.match(/^([^:]{2,48}):\s*(.+)$/)
    if (colonMatch) {
      const row = finalizeCaptionRow(colonMatch[1], colonMatch[2])
      if (row) return row
    }

    const byPattern = parseCaptionRowByPattern(block)
    if (byPattern) return byPattern

    const inline = parseInlineColon(block.textContent)
    if (inline) {
      const row = finalizeCaptionRow(inline.speaker, inline.text)
      if (row) return row
    }

    const speakerNode =
      block.querySelector('.NWpY1d') ||
      block.querySelector('[data-self-name]') ||
      block.querySelector('[data-sender-name]') ||
      block.querySelector('[data-participant-id] + span') ||
      block.querySelector('[class*="caption"] [dir="auto"]:first-child') ||
      block.querySelector('span[dir="auto"]:first-child')

    const textNode =
      block.querySelector('.ygicle') ||
      block.querySelector('.VbkSUe') ||
      block.querySelector('[data-message-text]') ||
      block.querySelector('[class*="caption"] [dir="auto"]:last-child') ||
      block.querySelector('span[dir="auto"]:last-child')

    let speaker = normalize(speakerNode?.textContent)
    let text = normalize(textNode?.textContent)

    if (speaker && text && speaker === text) {
      text = ''
    }

    if (!text) {
      const parts = normalize(block.textContent)
        .split('\n')
        .map((part) => normalize(part))
        .filter(Boolean)

      if (parts.length >= 2 && looksLikeSpeaker(parts[0])) {
        speaker = parts[0]
        text = parts.slice(1).join(' ')
      } else if (parts.length === 1) {
        const inlinePart = parseInlineColon(parts[0])
        if (inlinePart) {
          const row = finalizeCaptionRow(inlinePart.speaker, inlinePart.text)
          if (row) return row
        }
        text = parts[0]
      } else if (parts.length > 2 && looksLikeSpeaker(parts[0])) {
        speaker = parts[0]
        text = parts.slice(1).join(' ')
      }
    }

    if (!text || !looksLikeCaptionLine(text)) return null
    if (speaker && looksLikeIconLigature(speaker)) speaker = ''

    return finalizeCaptionRow(speaker, text)
  }

  function getCaptionCandidates(container) {
    if (!container) return []
    const seen = new Set()
    const candidates = []

    for (const child of container.children || []) {
      if (parseListItem(child)) candidates.push(child)
    }
    if (candidates.length > 0) return candidates

    const imgs = container.querySelectorAll('img')
    for (const img of imgs) {
      if (!isProfileImg(img)) continue
      const transcriptDiv = img.parentElement && img.parentElement.nextElementSibling
      const transcriptText = transcriptDiv ? normalize(transcriptDiv.textContent) : ''
      if (!transcriptText) continue
      const rowWrapper = img.parentElement && img.parentElement.parentElement
      if (!rowWrapper || seen.has(rowWrapper)) continue
      if (rowWrapper.closest('button') || rowWrapper.querySelector('button')) continue
      seen.add(rowWrapper)
      if (parseListItem(rowWrapper)) candidates.push(rowWrapper)
    }

    if (candidates.length > 0) return candidates

    const listItems = container.querySelectorAll('[role="listitem"]')
    for (const block of listItems) {
      if (parseListItem(block)) candidates.push(block)
    }

    if (candidates.length > 0) return candidates

    const list = container.querySelector('[role="list"]')
    if (list) {
      for (const child of list.children) {
        if (parseListItem(child)) candidates.push(child)
      }
    }

    if (parseListItem(container)) candidates.push(container)
    return candidates
  }

  function findBottomLiveCaption() {
    const nodes = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"], [role="status"]')
    let best = null
    let bestScore = -1

    for (const node of nodes) {
      const text = rowText(node) || normalize(node.textContent)
      if (!text || text.length > 600) continue
      const parsed = parseInlineColon(text)
      const captionText = parsed ? parsed.text : text
      if (!looksLikeCaptionLine(captionText)) continue

      const rect = node.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 8) continue

      const score = rect.top / Math.max(window.innerHeight, 1)
      if (score > bestScore) {
        bestScore = score
        best = node
      }
    }

    return best
  }

  function parseRows(region) {
    const rows = []
    const seenLocal = new Set()

    function pushRow(row) {
      if (!row || !row.text) return
      const signature = `${row.speaker}\n${row.text}`
      if (seenLocal.has(signature)) return
      seenLocal.add(signature)
      rows.push(row)
    }

    if (region) {
      for (const candidate of getCaptionCandidates(region)) {
        const row = parseListItem(candidate)
        if (row) pushRow(row)
      }

      if (rows.length === 0) {
        const inline = parseInlineColon(region.textContent)
        if (inline) pushRow(inline)
      }

      if (rows.length === 0) {
        const lines = normalize(region.textContent)
          .split('\n')
          .map((part) => normalize(part))
          .filter(Boolean)

        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i]
          const inline = parseInlineColon(line)
          if (inline) {
            pushRow(inline)
            continue
          }
          const next = lines[i + 1]
          if (next && looksLikeSpeaker(line) && !looksLikeSpeaker(next)) {
            pushRow({ speaker: resolveSpeaker(line), text: next })
            i += 1
          } else if (looksLikeCaptionLine(line)) {
            pushRow({ speaker: 'Participant', text: line })
          }
        }
      }
    }

    const bottom = findBottomLiveCaption()
    if (bottom) {
      const text = rowText(bottom) || normalize(bottom.textContent)
      const inline = parseInlineColon(text)
      if (inline) {
        pushRow(inline)
      } else if (looksLikeCaptionLine(text)) {
        pushRow({ speaker: 'Participant', text })
      }
    }

    return rows
  }

  function isRevision(older, newer) {
    const a = normalize(older).toLowerCase()
    const b = normalize(newer).toLowerCase()
    if (!a || !b) return false
    if (a === b) return true
    if (b.startsWith(a)) {
      const next = b[a.length]
      if (!next || /[\s.,!?;:]/.test(next)) return true
    }
    if (a.startsWith(b)) {
      const next = a[b.length]
      if (!next || /[\s.,!?;:]/.test(next)) return true
    }
    return false
  }

  function drainFinalized() {
    return state.finalized.splice(0, state.finalized.length)
  }

  function releaseScrollbackKey(speaker, text) {
    state.committedScrollback.delete(`${speaker}\n${text}`)
  }

  function collapseRevisionRows(rows) {
    const out = []
    for (const row of rows) {
      const prev = out[out.length - 1]
      if (prev && prev.speaker === row.speaker && isRevision(prev.text, row.text)) {
        if (normalize(row.text).length >= normalize(prev.text).length) {
          out[out.length - 1] = row
        }
        continue
      }
      out.push(row)
    }
    return out
  }

  function commitTurn(speaker, text) {
    const cleanSpeaker = resolveSpeaker(speaker)
    let cleanText = stripSpeakerPrefixFromText(cleanSpeaker, normalize(text))
    if (!cleanText || !looksLikeCaptionLine(cleanText) || isMeetChromeLine(cleanText)) return

    const signature = `${cleanSpeaker}\n${cleanText}`
    if (state.seen.has(signature)) return

    const last = state.finalized[state.finalized.length - 1]
    if (last && last.speaker === cleanSpeaker && isRevision(last.text, cleanText)) {
      if (cleanText.length >= last.text.length) {
        last.text = cleanText
        last.at = new Date().toISOString()
      }
      state.seen.add(signature)
      return
    }

    state.seen.add(signature)
    state.finalized.push({
      speaker: cleanSpeaker,
      text: cleanText,
      at: new Date().toISOString()
    })
    releaseScrollbackKey(cleanSpeaker, cleanText)
  }

  function collectRows() {
    const region = findCaptionRegion()
    return parseRows(region)
  }

  function captureTick() {
    const captionsOn = isCaptionsFeatureOn()
    const region = findCaptionRegion()
    const bottom = findBottomLiveCaption()
    const rows = collapseRevisionRows(parseRows(region))

    if (state.capturing) {
      maybeLogDiag(region, rows)
    }

    if (!rows.length) {
      return {
        captionsOn,
        regionFound: Boolean(region || bottom),
        visibleRows: 0
      }
    }

    if (rows.length >= 2) {
      for (let i = 0; i < rows.length - 1; i += 1) {
        const row = rows[i]
        const scrollKey = `${row.speaker}\n${row.text}`
        if (state.committedScrollback.has(scrollKey)) continue
        commitTurn(row.speaker, row.text)
        state.committedScrollback.add(scrollKey)
      }
    }

    const latest = rows[rows.length - 1]
    const signature = `${latest.speaker}\n${latest.text}`

    if (signature === state.lastSignature) {
      state.stableTicks += 1
      if (state.stableTicks >= STABILITY_TICKS) {
        commitTurn(latest.speaker, latest.text)
        state.speaker = ''
        state.text = ''
        state.stableTicks = 0
        state.lastSignature = ''
      }
    } else {
      if (state.speaker && state.text) {
        if (latest.speaker !== state.speaker) {
          commitTurn(state.speaker, state.text)
        } else if (!isRevision(state.text, latest.text)) {
          commitTurn(state.speaker, state.text)
        }
      }
      state.speaker = latest.speaker
      state.text = latest.text
      state.stableTicks = 0
      state.lastSignature = signature
    }

    return {
      captionsOn: captionsOn || Boolean(region || bottom),
      regionFound: true,
      visibleRows: rows.length
    }
  }

  function maybeLogDiag(region, rows) {
    const now = Date.now()
    if (now - state.lastDiagAt < 8000) return
    state.lastDiagAt = now

    if (!region) {
      console.info('[care-captions] no caption region found')
      return
    }

    console.info(
      '[care-captions] region found',
      region.getAttribute('aria-label') || region.getAttribute('jsname') || region.tagName,
      'rows=',
      rows.length,
      rows[0] ? `${rows[0].speaker}: ${rows[0].text.slice(0, 60)}` : ''
    )
  }

  function tick() {
    const status = captureTick()
    const batch = drainFinalized()
    return {
      enabled: status.captionsOn,
      finalized: batch,
      regionFound: status.regionFound,
      visibleRows: status.visibleRows
    }
  }

  function flush() {
    const rows = collapseRevisionRows(collectRows())
    for (const row of rows) {
      commitTurn(row.speaker, row.text)
    }
    if (state.text) {
      commitTurn(state.speaker, state.text)
      state.speaker = ''
      state.text = ''
      state.stableTicks = 0
      state.lastSignature = ''
    }
    const batch = drainFinalized()
    return { enabled: true, finalized: batch, regionFound: true, visibleRows: rows.length }
  }

  function startCapture() {
    if (state.capturing) return { started: true }
    state.capturing = true

    if (!state.observer) {
      state.observer = new MutationObserver(() => {
        if (!state.capturing) return
        captureTick()
      })
      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })
    }

    return { started: true }
  }

  function stopCapture() {
    state.capturing = false
    if (state.observer) {
      state.observer.disconnect()
      state.observer = null
    }
    return flush()
  }

  function controlLabel(node) {
    return [
      node.getAttribute('aria-label'),
      node.getAttribute('data-tooltip'),
      node.getAttribute('title'),
      node.textContent
    ]
      .filter(Boolean)
      .join(' ')
  }

  function isCaptionsFeatureOn() {
    const candidates = document.querySelectorAll(
      'button,[role="button"],[role="menuitemradio"],[data-tooltip],[role="switch"]'
    )

    for (const node of candidates) {
      const label = controlLabel(node)
      if (!label) continue

      if (/turn off captions|hide captions|disable captions|captions.*\bon\b/i.test(label)) {
        return true
      }
      if (/turn on captions|show captions|enable captions|captions.*\boff\b/i.test(label)) {
        return false
      }
      if (
        /\bcaptions?\b|\bcc\b|subtitles?|closed_caption/i.test(label) &&
        (node.getAttribute('aria-pressed') === 'true' ||
          node.getAttribute('aria-checked') === 'true' ||
          node.getAttribute('aria-selected') === 'true' ||
          node.getAttribute('data-is-muted') === 'false')
      ) {
        return true
      }
    }

    const region = findCaptionRegion()
    if (region && parseRows(region).length > 0) return true
    return Boolean(findBottomLiveCaption())
  }

  function captionsAreOn() {
    return isCaptionsFeatureOn()
  }

  function clickByLabel(patterns, { onlyIfOff = true } = {}) {
    const candidates = document.querySelectorAll(
      'button,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="switch"],[data-tooltip]'
    )
    for (const node of candidates) {
      const label = controlLabel(node)
      if (!label) continue
      if (!patterns.some((pattern) => pattern.test(label))) continue
      if (onlyIfOff && /turn off|hide caption|disable caption/i.test(label)) {
        return { clicked: false, alreadyOn: true }
      }
      node.click()
      return { clicked: true, alreadyOn: false }
    }
    return null
  }

  function tryEnableSpeakerNames() {
    if (state.speakerNamesAttempted) return null
    state.speakerNamesAttempted = true

    const settings = clickByLabel(
      [/caption settings/i, /subtitle settings/i, /captions settings/i, /^settings$/i],
      { onlyIfOff: false }
    )
    if (!settings) return null

    window.setTimeout(() => {
      clickByLabel(
        [/speaker/i, /who is speaking/i, /identify speakers/i, /show names/i, /attribution/i],
        { onlyIfOff: false }
      )
    }, 300)

    return { settings: true }
  }

  function tryEnableCaptions() {
    if (captionsAreOn()) {
      tryEnableSpeakerNames()
      return { clicked: false, alreadyOn: true, method: 'detected' }
    }

    const direct = clickByLabel([
      /turn on captions/i,
      /^captions$/i,
      /show captions/i,
      /subtitles/i,
      /closed_caption/i
    ])
    if (direct?.clicked) {
      window.setTimeout(() => tryEnableSpeakerNames(), 400)
      return { ...direct, method: 'button' }
    }
    if (direct?.alreadyOn) {
      tryEnableSpeakerNames()
      return { ...direct, method: 'button' }
    }

    return { clicked: false, alreadyOn: false, method: 'none' }
  }

  function captionStatus() {
    const region = findCaptionRegion()
    const bottom = findBottomLiveCaption()
    const rows = region ? parseRows(region) : []
    return {
      on: isCaptionsFeatureOn(),
      regionFound: Boolean(region || bottom),
      visibleRows: rows.length
    }
  }

  function getCallState() {
    const url = location.href || ''
    const inCallUrl = /meet\.google\.com\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}/i.test(url)

    const leaveButton = document.querySelector(
      '[aria-label*="Leave call" i], [aria-label*="Hang up" i], [data-tooltip*="Leave call" i]'
    )
    if (leaveButton) return 'in-call'

    const bodyText = (document.body && document.body.innerText) || ''
    if (
      /you left the meeting|return to home screen|the meeting has ended|rejoin the meeting|thanks for joining/i.test(
        bodyText
      )
    ) {
      return 'left'
    }

    if (!inCallUrl) {
      if (/meet\.google\.com\/?(?:\?|#|$)/.test(url) || /\/landing/.test(url)) {
        return 'left'
      }
      if (!/meet\.google\.com/.test(url)) {
        return 'left'
      }
    }

    return inCallUrl ? 'unknown' : 'left'
  }

  window.__careMeetCaptions = {
    tick,
    flush,
    startCapture,
    stopCapture,
    tryEnableCaptions,
    tryEnableSpeakerNames,
    captionStatus,
    getCallState
  }
})()
