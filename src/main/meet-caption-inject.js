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
    speakerNamesAttempted: false,
    capturing: false,
    observer: null
  }

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim()
  }

  function isProfileImg(img) {
    if (!img || img.tagName !== 'IMG') return false
    const src = (img.getAttribute('src') || '').trim()
    return src.length > 0 && (src.startsWith('http') || src.startsWith('data:'))
  }

  function isIconName(text) {
    return /^[a-z_]+$/.test(text) && text.length <= 24
  }

  function looksLikeSpeaker(text) {
    if (!text || text.length > 48) return false
    if (isIconName(text)) return false
    if (/^you$/i.test(text)) return true
    if (/^(participant|speaker)$/i.test(text)) return false
    if (/:/.test(text)) return false
    return true
  }

  function resolveSpeaker(speaker) {
    const clean = normalize(speaker)
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
    if (!body || isIconName(body)) return null
    return { speaker: resolveSpeaker(match[1]), text: body }
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
    return { speaker: resolveSpeaker(speaker), text }
  }

  function parseListItem(block) {
    const aria = block.getAttribute('aria-label') || ''
    const saidMatch = aria.match(/^(.+?)\s+said[,:]?\s*(.+)$/i)
    if (saidMatch) {
      return { speaker: resolveSpeaker(saidMatch[1]), text: normalize(saidMatch[2]) }
    }

    const colonMatch = aria.match(/^([^:]{2,48}):\s*(.+)$/)
    if (colonMatch) {
      return { speaker: resolveSpeaker(colonMatch[1]), text: normalize(colonMatch[2]) }
    }

    const byPattern = parseCaptionRowByPattern(block)
    if (byPattern) return byPattern

    const inline = parseInlineColon(block.textContent)
    if (inline) return inline

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
        if (inlinePart) return inlinePart
        text = parts[0]
      } else if (parts.length > 2 && looksLikeSpeaker(parts[0])) {
        speaker = parts[0]
        text = parts.slice(1).join(' ')
      }
    }

    if (!text || isIconName(text)) return null
    if (speaker && isIconName(speaker)) speaker = ''

    return { speaker: resolveSpeaker(speaker), text }
  }

  function getCaptionCandidates(container) {
    if (!container) return []
    const seen = new Set()
    const candidates = []

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

    if (candidates.length > 0) return candidates

    for (const child of container.children || []) {
      if (parseListItem(child)) candidates.push(child)
    }

    if (parseListItem(container)) candidates.push(container)
    return candidates
  }

  function findCaptionRegion() {
    const exact =
      document.querySelector('[role="region"][aria-label="Captions"]') ||
      document.querySelector('[role="region"][aria-label="Live captions"]')
    if (exact) return exact

    const selectors = [
      '[role="region"][aria-label*="caption" i]',
      '[jsname="tgaKEf"]',
      '[data-caption-window]'
    ]
    for (const selector of selectors) {
      const node = document.querySelector(selector)
      if (node) return node
    }

    const liveRegions = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
    let best = null
    let bestScore = -1

    for (const node of liveRegions) {
      const text = normalize(node.textContent)
      if (text.length < 2 || text.length >= 8000) continue

      const rect = node.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 8) continue

      let score = 0
      if (parseInlineColon(text)) score += 3
      if (rect.top > window.innerHeight * 0.45) score += 2
      if (/caption|subtitle/i.test(node.getAttribute('aria-label') || '')) score += 4
      if (getCaptionCandidates(node).length > 0) score += 5

      if (score > bestScore) {
        bestScore = score
        best = node
      }
    }

    return best
  }

  function findBottomLiveCaption() {
    const nodes = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"], [role="status"]')
    let best = null
    let bestScore = -1

    for (const node of nodes) {
      const text = normalize(node.textContent)
      if (!text || text.length > 600) continue
      const parsed = parseInlineColon(text)
      if (!parsed) continue

      const rect = node.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 8) continue

      const score = rect.top / Math.max(window.innerHeight, 1) + (parsed.speaker !== 'Participant' ? 0.5 : 0)
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
          } else if (line) {
            pushRow({ speaker: 'Participant', text: line })
          }
        }
      }
    }

    const bottom = findBottomLiveCaption()
    if (bottom) {
      const parsed = parseInlineColon(bottom.textContent)
      if (parsed) pushRow(parsed)
    }

    return rows
  }

  function commitTurn(speaker, text) {
    const cleanSpeaker = resolveSpeaker(speaker)
    const cleanText = normalize(text)
    if (!cleanText) return

    const signature = `${cleanSpeaker}\n${cleanText}`
    if (state.seen.has(signature)) return
    state.seen.add(signature)

    state.finalized.push({
      speaker: cleanSpeaker,
      text: cleanText,
      at: new Date().toISOString()
    })
  }

  function collectRows() {
    const region = findCaptionRegion()
    return parseRows(region)
  }

  function tick() {
    const captionsOn = isCaptionsFeatureOn()
    const region = findCaptionRegion()
    const bottom = findBottomLiveCaption()
    const rows = parseRows(region)

    if (!rows.length) {
      return {
        enabled: captionsOn,
        finalized: [],
        regionFound: Boolean(region || bottom)
      }
    }

    for (let i = 0; i < rows.length - 1; i += 1) {
      commitTurn(rows[i].speaker, rows[i].text)
    }

    const latest = rows[rows.length - 1]
    const signature = `${latest.speaker}\n${latest.text}`

    if (signature === state.lastSignature) {
      state.stableTicks += 1
      if (state.stableTicks >= STABILITY_TICKS && state.text) {
        commitTurn(state.speaker, state.text)
        state.speaker = ''
        state.text = ''
        state.stableTicks = 0
        state.lastSignature = ''
      }
    } else {
      if (state.text && state.stableTicks >= 1) {
        commitTurn(state.speaker, state.text)
      }
      state.speaker = latest.speaker
      state.text = latest.text
      state.stableTicks = 0
      state.lastSignature = signature
    }

    const batch = state.finalized.splice(0, state.finalized.length)
    return { enabled: captionsOn || Boolean(region || bottom), finalized: batch, regionFound: true }
  }

  function flush() {
    const rows = collectRows()
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
    const batch = state.finalized.splice(0, state.finalized.length)
    return { enabled: true, finalized: batch, regionFound: true }
  }

  function startCapture() {
    if (state.capturing) return { started: true }
    state.capturing = true

    if (!state.observer) {
      state.observer = new MutationObserver(() => {
        if (!state.capturing) return
        tick()
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
      'button,[role="button"],[role="menuitemradio"],[data-tooltip]'
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
        /\bcaptions?\b|\bcc\b|subtitles?/i.test(label) &&
        (node.getAttribute('aria-pressed') === 'true' ||
          node.getAttribute('aria-checked') === 'true' ||
          node.getAttribute('data-is-muted') === 'false')
      ) {
        return true
      }
    }

    return Boolean(findCaptionRegion() || findBottomLiveCaption())
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

    const direct = clickByLabel([/turn on captions/i, /^captions$/i, /subtitles/i])
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
    return {
      on: isCaptionsFeatureOn(),
      regionFound: Boolean(region || bottom)
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
