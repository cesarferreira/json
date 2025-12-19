import './style.css'

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]

interface ParseResult {
  valid: boolean
  data?: JsonValue
  error?: string
}

interface Stats {
  objects: number
  arrays: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
}

interface DiffResult {
  type: 'added' | 'removed' | 'changed'
  path: string
  oldValue?: JsonValue
  newValue?: JsonValue
}

// Storage keys
const STORAGE_KEY = 'json-parser-data'
const THEME_KEY = 'json-parser-theme'

// DOM Elements - Editor Mode
const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement
const syntaxHighlight = document.getElementById('syntax-highlight') as HTMLPreElement
const lineNumbers = document.getElementById('line-numbers') as HTMLDivElement
const jsonTree = document.getElementById('json-tree') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const statsEl = document.getElementById('stats') as HTMLSpanElement

// DOM Elements - Toolbar
const formatBtn = document.getElementById('format-btn') as HTMLButtonElement
const minifyBtn = document.getElementById('minify-btn') as HTMLButtonElement
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement
const urlBtn = document.getElementById('url-btn') as HTMLButtonElement
const shareBtn = document.getElementById('share-btn') as HTMLButtonElement
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement
const expandAllBtn = document.getElementById('expand-all-btn') as HTMLButtonElement
const collapseAllBtn = document.getElementById('collapse-all-btn') as HTMLButtonElement
const themeBtn = document.getElementById('theme-btn') as HTMLButtonElement

// DOM Elements - Mode Toggle
const editorModeBtn = document.getElementById('editor-mode-btn') as HTMLButtonElement
const diffModeBtn = document.getElementById('diff-mode-btn') as HTMLButtonElement
const editorView = document.getElementById('editor-view') as HTMLElement
const diffView = document.getElementById('diff-view') as HTMLElement

// DOM Elements - Search
const searchInput = document.getElementById('search-input') as HTMLInputElement
const searchResults = document.getElementById('search-results') as HTMLSpanElement
const searchPrev = document.getElementById('search-prev') as HTMLButtonElement
const searchNext = document.getElementById('search-next') as HTMLButtonElement
const searchClear = document.getElementById('search-clear') as HTMLButtonElement

// DOM Elements - Diff Mode
const diffInputLeft = document.getElementById('diff-input-left') as HTMLTextAreaElement
const diffInputRight = document.getElementById('diff-input-right') as HTMLTextAreaElement
const diffHighlightLeft = document.getElementById('diff-highlight-left') as HTMLPreElement
const diffHighlightRight = document.getElementById('diff-highlight-right') as HTMLPreElement
const diffLineNumbersLeft = document.getElementById('diff-line-numbers-left') as HTMLDivElement
const diffLineNumbersRight = document.getElementById('diff-line-numbers-right') as HTMLDivElement
const diffStatusLeft = document.getElementById('diff-status-left') as HTMLSpanElement
const diffStatusRight = document.getElementById('diff-status-right') as HTMLSpanElement
const diffResult = document.getElementById('diff-result') as HTMLDivElement
const diffStats = document.getElementById('diff-stats') as HTMLSpanElement

// DOM Elements - Modals
const urlModal = document.getElementById('url-modal') as HTMLDivElement
const urlModalClose = document.getElementById('url-modal-close') as HTMLButtonElement
const urlInput = document.getElementById('url-input') as HTMLInputElement
const urlFetchBtn = document.getElementById('url-fetch-btn') as HTMLButtonElement
const urlError = document.getElementById('url-error') as HTMLDivElement
const shortcutsModal = document.getElementById('shortcuts-modal') as HTMLDivElement
const shortcutsModalClose = document.getElementById('shortcuts-modal-close') as HTMLButtonElement
const aiRequirements = document.getElementById('ai-requirements') as HTMLDivElement

// DOM Elements - Path Display
const pathDisplay = document.getElementById('path-display') as HTMLDivElement
const pathText = document.getElementById('path-text') as HTMLSpanElement
const pathCopy = document.getElementById('path-copy') as HTMLButtonElement

// DOM Elements - AI
const aiBtn = document.getElementById('ai-btn') as HTMLButtonElement
const aiPanel = document.getElementById('ai-panel') as HTMLDivElement
const aiPanelClose = document.getElementById('ai-panel-close') as HTMLButtonElement
const aiMessages = document.getElementById('ai-messages') as HTMLDivElement
const aiUnavailable = document.getElementById('ai-unavailable') as HTMLDivElement
const aiInput = document.getElementById('ai-input') as HTMLInputElement
const aiSend = document.getElementById('ai-send') as HTMLButtonElement

// DOM Elements - Other
const resizer = document.getElementById('resizer') as HTMLDivElement
const leftPane = document.querySelector('.left-pane') as HTMLDivElement
const toast = document.getElementById('toast') as HTMLDivElement
const helpBtn = document.getElementById('help-btn') as HTMLButtonElement

// State
let searchMatches: HTMLElement[] = []
let currentMatchIndex = -1
let currentPath = ''
let pathTimeout: number | null = null
let aiSession: any = null
let aiAvailable = false

// ============ UTILITY FUNCTIONS ============

function parseJson(text: string): ParseResult {
  if (!text.trim()) {
    return { valid: false }
  }
  try {
    const data = JSON.parse(text)
    return { valid: true, data }
  } catch (e) {
    const error = e as SyntaxError
    return { valid: false, error: error.message }
  }
}

function getType(value: JsonValue): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.textContent = message
  toast.className = `toast ${type}`
  setTimeout(() => {
    toast.classList.add('hidden')
  }, 2500)
}

// ============ SYNTAX HIGHLIGHTING ============

function highlightJson(text: string): string {
  if (!text) return ''

  let result = ''
  let i = 0
  let inString = false
  let isKey = false

  while (i < text.length) {
    const char = text[i]

    if (char === '"' && (i === 0 || text[i - 1] !== '\\')) {
      if (!inString) {
        inString = true
        // Check if this is a key (next non-whitespace after string end is :)
        let j = i + 1
        while (j < text.length && text[j] !== '"') {
          if (text[j] === '\\') j++
          j++
        }
        j++
        while (j < text.length && /\s/.test(text[j])) j++
        isKey = text[j] === ':'
        result += `<span class="hl-${isKey ? 'key' : 'string'}">"`
      } else {
        result += '"</span>'
        inString = false
        isKey = false
      }
    } else if (inString) {
      result += escapeHtml(char)
    } else if (/[{}\[\]]/.test(char)) {
      result += `<span class="hl-bracket">${char}</span>`
    } else if (char === ':' || char === ',') {
      result += `<span class="hl-punctuation">${char}</span>`
    } else if (/\d/.test(char) || (char === '-' && /\d/.test(text[i + 1] || ''))) {
      let num = char
      i++
      while (i < text.length && /[\d.eE+-]/.test(text[i])) {
        num += text[i]
        i++
      }
      result += `<span class="hl-number">${num}</span>`
      continue
    } else if (text.slice(i, i + 4) === 'true') {
      result += '<span class="hl-boolean">true</span>'
      i += 4
      continue
    } else if (text.slice(i, i + 5) === 'false') {
      result += '<span class="hl-boolean">false</span>'
      i += 5
      continue
    } else if (text.slice(i, i + 4) === 'null') {
      result += '<span class="hl-null">null</span>'
      i += 4
      continue
    } else {
      result += escapeHtml(char)
    }
    i++
  }

  return result
}

function updateSyntaxHighlight(textarea: HTMLTextAreaElement, highlight: HTMLPreElement) {
  highlight.innerHTML = highlightJson(textarea.value) + '\n'
}

function updateLineNumbers(textarea: HTMLTextAreaElement, lineNumbersEl: HTMLDivElement) {
  const lines = textarea.value.split('\n').length
  let html = ''
  for (let i = 1; i <= lines; i++) {
    html += `<span class="line-number">${i}</span>`
  }
  lineNumbersEl.innerHTML = html
}

function syncScroll(textarea: HTMLTextAreaElement, highlight: HTMLPreElement, lineNumbersEl: HTMLDivElement) {
  highlight.scrollTop = textarea.scrollTop
  highlight.scrollLeft = textarea.scrollLeft
  lineNumbersEl.scrollTop = textarea.scrollTop
}

// ============ STATS ============

function countStats(value: JsonValue): Stats {
  const stats: Stats = { objects: 0, arrays: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0 }

  function count(v: JsonValue) {
    const type = getType(v)
    switch (type) {
      case 'object':
        stats.objects++
        Object.values(v as JsonObject).forEach(count)
        break
      case 'array':
        stats.arrays++
        ;(v as JsonArray).forEach(count)
        break
      case 'string': stats.strings++; break
      case 'number': stats.numbers++; break
      case 'boolean': stats.booleans++; break
      case 'null': stats.nulls++; break
    }
  }

  count(value)
  return stats
}

function updateStats(data: JsonValue | undefined) {
  if (!data) {
    statsEl.textContent = ''
    return
  }

  const stats = countStats(data)
  const parts: string[] = []
  if (stats.objects > 0) parts.push(`${stats.objects} obj`)
  if (stats.arrays > 0) parts.push(`${stats.arrays} arr`)
  if (stats.strings > 0) parts.push(`${stats.strings} str`)
  if (stats.numbers > 0) parts.push(`${stats.numbers} num`)
  if (stats.booleans > 0) parts.push(`${stats.booleans} bool`)
  statsEl.textContent = parts.join(' | ')
}

// ============ JSON TREE ============

function createTreeNode(
  key: string | number | null,
  value: JsonValue,
  isLast: boolean,
  path: string
): HTMLElement {
  const type = getType(value)
  const node = document.createElement('div')
  node.className = 'tree-node'
  node.dataset.path = path

  const line = document.createElement('div')
  line.className = 'tree-line'
  line.dataset.path = path

  // Click handler for path display
  line.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('toggle') ||
        (e.target as HTMLElement).classList.contains('copy-value-btn')) return
    showPath(path)
  })

  const isExpandable = type === 'object' || type === 'array'

  if (isExpandable) {
    const toggle = document.createElement('span')
    toggle.className = 'toggle'
    toggle.textContent = '▼'
    toggle.addEventListener('click', (e) => {
      e.stopPropagation()
      const children = node.querySelector('.children') as HTMLElement
      const isCollapsed = children.classList.contains('collapsed')
      children.classList.toggle('collapsed')
      toggle.textContent = isCollapsed ? '▼' : '▶'
      const bracket = line.querySelector('.bracket') as HTMLElement
      if (bracket) bracket.classList.toggle('collapsed', !isCollapsed)
    })
    line.appendChild(toggle)
  } else {
    const placeholder = document.createElement('span')
    placeholder.className = 'toggle-placeholder'
    line.appendChild(placeholder)
  }

  if (key !== null) {
    const keySpan = document.createElement('span')
    keySpan.className = 'key'
    keySpan.textContent = typeof key === 'string' ? `"${escapeHtml(key)}"` : `${key}`
    keySpan.dataset.searchable = typeof key === 'string' ? key : String(key)
    line.appendChild(keySpan)

    const colon = document.createElement('span')
    colon.className = 'colon'
    colon.textContent = ':'
    line.appendChild(colon)
  }

  if (type === 'object') {
    const obj = value as JsonObject
    const keys = Object.keys(obj)

    const bracket = document.createElement('span')
    bracket.className = 'bracket'
    bracket.textContent = '{'
    line.appendChild(bracket)

    const count = document.createElement('span')
    count.className = 'item-count'
    count.textContent = `${keys.length} ${keys.length === 1 ? 'key' : 'keys'}`
    line.appendChild(count)

    // Copy button for objects
    const copyBtn = document.createElement('button')
    copyBtn.className = 'copy-value-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      copyToClipboard(JSON.stringify(value, null, 2))
    })
    line.appendChild(copyBtn)

    node.appendChild(line)

    const children = document.createElement('div')
    children.className = 'children'

    keys.forEach((k, i) => {
      const childPath = path ? `${path}.${k}` : `$.${k}`
      children.appendChild(createTreeNode(k, obj[k], i === keys.length - 1, childPath))
    })

    const closingLine = document.createElement('div')
    closingLine.className = 'tree-line'
    const closingPlaceholder = document.createElement('span')
    closingPlaceholder.className = 'toggle-placeholder'
    closingLine.appendChild(closingPlaceholder)
    const closingBracket = document.createElement('span')
    closingBracket.className = 'bracket'
    closingBracket.textContent = '}' + (isLast ? '' : ',')
    closingLine.appendChild(closingBracket)
    children.appendChild(closingLine)

    node.appendChild(children)
  } else if (type === 'array') {
    const arr = value as JsonArray

    const bracket = document.createElement('span')
    bracket.className = 'bracket'
    bracket.textContent = '['
    line.appendChild(bracket)

    const count = document.createElement('span')
    count.className = 'item-count'
    count.textContent = `${arr.length} ${arr.length === 1 ? 'item' : 'items'}`
    line.appendChild(count)

    // Copy button for arrays
    const copyBtn = document.createElement('button')
    copyBtn.className = 'copy-value-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      copyToClipboard(JSON.stringify(value, null, 2))
    })
    line.appendChild(copyBtn)

    node.appendChild(line)

    const children = document.createElement('div')
    children.className = 'children'

    arr.forEach((item, i) => {
      const childPath = path ? `${path}[${i}]` : `$[${i}]`
      children.appendChild(createTreeNode(i, item, i === arr.length - 1, childPath))
    })

    const closingLine = document.createElement('div')
    closingLine.className = 'tree-line'
    const closingPlaceholder = document.createElement('span')
    closingPlaceholder.className = 'toggle-placeholder'
    closingLine.appendChild(closingPlaceholder)
    const closingBracket = document.createElement('span')
    closingBracket.className = 'bracket'
    closingBracket.textContent = ']' + (isLast ? '' : ',')
    closingLine.appendChild(closingBracket)
    children.appendChild(closingLine)

    node.appendChild(children)
  } else {
    const valueSpan = document.createElement('span')
    valueSpan.className = `value ${type}`

    let displayValue = ''
    if (type === 'string') {
      displayValue = `"${escapeHtml(value as string)}"`
      valueSpan.dataset.searchable = value as string
    } else if (type === 'null') {
      displayValue = 'null'
    } else {
      displayValue = String(value)
      valueSpan.dataset.searchable = String(value)
    }

    valueSpan.textContent = displayValue + (isLast ? '' : ',')
    line.appendChild(valueSpan)

    // Copy button for primitive values
    const copyBtn = document.createElement('button')
    copyBtn.className = 'copy-value-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      copyToClipboard(type === 'string' ? value as string : String(value))
    })
    line.appendChild(copyBtn)

    node.appendChild(line)
  }

  return node
}

function renderTree(data: JsonValue) {
  jsonTree.innerHTML = ''
  const tree = createTreeNode(null, data, true, '$')
  jsonTree.appendChild(tree)
}

function showError(message: string) {
  jsonTree.innerHTML = `<div class="error-message">Error: ${escapeHtml(message)}</div>`
}

function showEmpty() {
  jsonTree.innerHTML = '<div class="empty-state">Paste JSON on the left to visualize</div>'
}

function updateStatus(result: ParseResult, el: HTMLSpanElement = statusEl) {
  if (!result.valid && !result.error) {
    el.textContent = ''
    el.className = 'status'
    return
  }

  if (result.valid) {
    el.textContent = 'Valid JSON'
    el.className = 'status valid'
  } else {
    el.textContent = 'Invalid JSON'
    el.className = 'status invalid'
  }
}

// ============ PATH DISPLAY ============

function showPath(path: string) {
  currentPath = path
  pathText.textContent = path
  pathDisplay.classList.remove('hidden')

  if (pathTimeout) clearTimeout(pathTimeout)
  pathTimeout = window.setTimeout(() => {
    pathDisplay.classList.add('hidden')
  }, 5000)
}

pathCopy.addEventListener('click', () => {
  copyToClipboard(currentPath)
  showToast('Path copied to clipboard')
})

// ============ SEARCH ============

function performSearch(query: string) {
  // Clear previous highlights
  searchMatches.forEach(el => {
    el.classList.remove('search-match', 'search-current')
  })
  searchMatches = []
  currentMatchIndex = -1

  if (!query.trim()) {
    searchResults.textContent = ''
    return
  }

  const lowerQuery = query.toLowerCase()
  const allLines = jsonTree.querySelectorAll('.tree-line')

  allLines.forEach(line => {
    const keyEl = line.querySelector('.key')
    const valueEl = line.querySelector('.value')

    const keyText = keyEl?.getAttribute('data-searchable')?.toLowerCase() || ''
    const valueText = valueEl?.getAttribute('data-searchable')?.toLowerCase() || ''

    if (keyText.includes(lowerQuery) || valueText.includes(lowerQuery)) {
      searchMatches.push(line as HTMLElement)
      line.classList.add('search-match')

      // Expand parent nodes
      let parent = line.parentElement
      while (parent) {
        if (parent.classList.contains('children') && parent.classList.contains('collapsed')) {
          parent.classList.remove('collapsed')
          const toggle = parent.previousElementSibling?.querySelector('.toggle')
          if (toggle) toggle.textContent = '▼'
        }
        parent = parent.parentElement
      }
    }
  })

  if (searchMatches.length > 0) {
    currentMatchIndex = 0
    highlightCurrentMatch()
    searchResults.textContent = `1/${searchMatches.length}`
  } else {
    searchResults.textContent = 'No results'
  }
}

function highlightCurrentMatch() {
  searchMatches.forEach((el, i) => {
    el.classList.toggle('search-current', i === currentMatchIndex)
  })

  if (searchMatches[currentMatchIndex]) {
    searchMatches[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function nextMatch() {
  if (searchMatches.length === 0) return
  currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length
  highlightCurrentMatch()
  searchResults.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`
}

function prevMatch() {
  if (searchMatches.length === 0) return
  currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length
  highlightCurrentMatch()
  searchResults.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`
}

function clearSearch() {
  searchInput.value = ''
  searchMatches.forEach(el => {
    el.classList.remove('search-match', 'search-current')
  })
  searchMatches = []
  currentMatchIndex = -1
  searchResults.textContent = ''
}

// ============ DIFF ============

function compareJson(obj1: JsonValue, obj2: JsonValue, path = '$'): DiffResult[] {
  const results: DiffResult[] = []

  const type1 = getType(obj1)
  const type2 = getType(obj2)

  if (type1 !== type2) {
    results.push({ type: 'changed', path, oldValue: obj1, newValue: obj2 })
    return results
  }

  if (type1 === 'object') {
    const o1 = obj1 as JsonObject
    const o2 = obj2 as JsonObject
    const allKeys = new Set([...Object.keys(o1), ...Object.keys(o2)])

    allKeys.forEach(key => {
      const childPath = `${path}.${key}`
      if (!(key in o1)) {
        results.push({ type: 'added', path: childPath, newValue: o2[key] })
      } else if (!(key in o2)) {
        results.push({ type: 'removed', path: childPath, oldValue: o1[key] })
      } else {
        results.push(...compareJson(o1[key], o2[key], childPath))
      }
    })
  } else if (type1 === 'array') {
    const a1 = obj1 as JsonArray
    const a2 = obj2 as JsonArray
    const maxLen = Math.max(a1.length, a2.length)

    for (let i = 0; i < maxLen; i++) {
      const childPath = `${path}[${i}]`
      if (i >= a1.length) {
        results.push({ type: 'added', path: childPath, newValue: a2[i] })
      } else if (i >= a2.length) {
        results.push({ type: 'removed', path: childPath, oldValue: a1[i] })
      } else {
        results.push(...compareJson(a1[i], a2[i], childPath))
      }
    }
  } else if (obj1 !== obj2) {
    results.push({ type: 'changed', path, oldValue: obj1, newValue: obj2 })
  }

  return results
}

function formatValue(value: JsonValue): string {
  if (typeof value === 'string') return `"${escapeHtml(value)}"`
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function renderDiff() {
  const leftResult = parseJson(diffInputLeft.value)
  const rightResult = parseJson(diffInputRight.value)

  updateStatus(leftResult, diffStatusLeft)
  updateStatus(rightResult, diffStatusRight)

  if (!leftResult.valid || !rightResult.valid) {
    diffResult.innerHTML = '<div class="diff-empty">Enter valid JSON in both panes to compare</div>'
    diffStats.textContent = ''
    return
  }

  const diffs = compareJson(leftResult.data!, rightResult.data!)

  if (diffs.length === 0) {
    diffResult.innerHTML = '<div class="diff-empty">No differences found</div>'
    diffStats.textContent = 'Identical'
    return
  }

  const added = diffs.filter(d => d.type === 'added').length
  const removed = diffs.filter(d => d.type === 'removed').length
  const changed = diffs.filter(d => d.type === 'changed').length

  diffStats.textContent = `+${added} -${removed} ~${changed}`

  let html = ''
  diffs.forEach(diff => {
    html += `<div class="diff-item ${diff.type}">`
    html += `<div class="diff-path">${escapeHtml(diff.path)}</div>`
    html += '<div class="diff-values">'

    if (diff.type === 'added') {
      html += `<span class="diff-new">+ ${formatValue(diff.newValue!)}</span>`
    } else if (diff.type === 'removed') {
      html += `<span class="diff-old">- ${formatValue(diff.oldValue!)}</span>`
    } else {
      html += `<span class="diff-old">${formatValue(diff.oldValue!)}</span>`
      html += '<span class="diff-arrow">→</span>'
      html += `<span class="diff-new">${formatValue(diff.newValue!)}</span>`
    }

    html += '</div></div>'
  })

  diffResult.innerHTML = html
}

// ============ COPY / DOWNLOAD / SHARE ============

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('Copied to clipboard')
  } catch {
    showToast('Failed to copy', 'error')
  }
}

function downloadJson() {
  const result = parseJson(jsonInput.value)
  if (!result.valid) {
    showToast('Invalid JSON', 'error')
    return
  }

  const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.json'
  a.click()
  URL.revokeObjectURL(url)
  showToast('JSON downloaded')
}

function shareViaUrl() {
  const text = jsonInput.value.trim()
  if (!text) {
    showToast('No JSON to share', 'error')
    return
  }

  try {
    const compressed = btoa(encodeURIComponent(text))
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`

    if (url.length > 2000) {
      showToast('JSON too large to share via URL', 'error')
      return
    }

    copyToClipboard(url)
    showToast('Share URL copied to clipboard')
  } catch {
    showToast('Failed to create share URL', 'error')
  }
}

function loadFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const data = params.get('data')

  if (data) {
    try {
      const decoded = decodeURIComponent(atob(data))
      jsonInput.value = decoded
      handleInput()
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      console.error('Failed to load JSON from URL')
    }
  }
}

// ============ URL IMPORT ============

async function fetchFromUrl() {
  const url = urlInput.value.trim()
  if (!url) return

  urlError.classList.add('hidden')
  urlFetchBtn.textContent = 'Loading...'
  urlFetchBtn.disabled = true

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const text = await response.text()
    const result = parseJson(text)

    if (!result.valid) {
      throw new Error('Response is not valid JSON')
    }

    jsonInput.value = JSON.stringify(result.data, null, 2)
    handleInput()
    closeUrlModal()
    showToast('JSON imported from URL')
  } catch (e) {
    urlError.textContent = `Error: ${(e as Error).message}`
    urlError.classList.remove('hidden')
  } finally {
    urlFetchBtn.textContent = 'Fetch'
    urlFetchBtn.disabled = false
  }
}

function openUrlModal() {
  urlModal.classList.remove('hidden')
  urlInput.focus()
}

function closeUrlModal() {
  urlModal.classList.add('hidden')
  urlInput.value = ''
  urlError.classList.add('hidden')
}

// ============ THEME ============

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  const newTheme = currentTheme === 'light' ? 'dark' : 'light'

  document.documentElement.setAttribute('data-theme', newTheme)
  localStorage.setItem(THEME_KEY, newTheme)
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
}

// ============ LOCAL STORAGE ============

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, jsonInput.value)
}

function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    jsonInput.value = saved
    return true
  }
  return false
}

// ============ AI ASSISTANT ============

async function checkAIAvailability(): Promise<boolean> {
  try {
    // Check if the AI API is available
    if (!('ai' in window)) {
      return false
    }

    const ai = (window as any).ai
    if (!ai || !ai.languageModel) {
      return false
    }

    const capabilities = await ai.languageModel.capabilities()
    return capabilities.available === 'readily' || capabilities.available === 'after-download'
  } catch {
    return false
  }
}

async function initAISession() {
  try {
    const ai = (window as any).ai
    aiSession = await ai.languageModel.create({
      systemPrompt: `You are a helpful assistant that answers questions about JSON data.
The user will provide JSON data and ask questions about it.
Keep your answers concise and focused on the JSON structure and content.
When referring to specific values, mention their path in the JSON (e.g., "settings.theme").`
    })
    return true
  } catch (e) {
    console.error('Failed to create AI session:', e)
    return false
  }
}

function addAIMessage(content: string, type: 'user' | 'ai' | 'loading') {
  const messageDiv = document.createElement('div')
  messageDiv.className = `ai-message ai-message-${type}`

  if (type === 'loading') {
    messageDiv.textContent = 'Thinking'
  } else {
    messageDiv.textContent = content
  }

  aiMessages.appendChild(messageDiv)
  aiMessages.scrollTop = aiMessages.scrollHeight

  return messageDiv
}

function removeLoadingMessage() {
  const loading = aiMessages.querySelector('.ai-message-loading')
  if (loading) {
    loading.remove()
  }
}

async function sendAIMessage() {
  const question = aiInput.value.trim()
  if (!question) return

  const jsonData = jsonInput.value.trim()
  if (!jsonData) {
    showToast('No JSON data to analyze', 'error')
    return
  }

  // Add user message
  addAIMessage(question, 'user')
  aiInput.value = ''
  aiSend.disabled = true

  // Add loading message
  addAIMessage('', 'loading')

  try {
    // Initialize session if needed
    if (!aiSession) {
      const success = await initAISession()
      if (!success) {
        throw new Error('Failed to initialize AI')
      }
    }

    // Build the prompt with JSON context
    const prompt = `Here is the JSON data:
\`\`\`json
${jsonData}
\`\`\`

User question: ${question}`

    // Get AI response
    const response = await aiSession.prompt(prompt)

    removeLoadingMessage()
    addAIMessage(response, 'ai')
  } catch (e) {
    removeLoadingMessage()
    addAIMessage('Sorry, I encountered an error. Please try again.', 'ai')
    console.error('AI error:', e)
  } finally {
    aiSend.disabled = false
  }
}

function toggleAIPanel() {
  const isHidden = aiPanel.classList.contains('hidden')

  if (isHidden) {
    aiPanel.classList.remove('hidden')

    if (!aiAvailable) {
      aiMessages.classList.add('hidden')
      aiUnavailable.classList.remove('hidden')
      aiInput.disabled = true
      aiSend.disabled = true
    } else {
      aiMessages.classList.remove('hidden')
      aiUnavailable.classList.add('hidden')
      aiInput.disabled = false
      aiSend.disabled = false
      aiInput.focus()
    }
  } else {
    aiPanel.classList.add('hidden')
  }
}

function getChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return null
}

async function checkAIFlags(): Promise<{ hasPromptApi: boolean; hasModel: boolean }> {
  try {
    const hasPromptApi = 'ai' in window && !!(window as any).ai?.languageModel
    let hasModel = false

    if (hasPromptApi) {
      const ai = (window as any).ai
      const capabilities = await ai.languageModel.capabilities()
      // Model is available if it's ready or can be downloaded
      hasModel = capabilities.available === 'readily' ||
                 capabilities.available === 'after-download' ||
                 capabilities.available !== 'no'
    }

    return { hasPromptApi, hasModel }
  } catch {
    return { hasPromptApi: false, hasModel: false }
  }
}

async function updateAIRequirementsStatus() {
  const chromeVersion = getChromeVersion()
  const isChrome = chromeVersion !== null
  const isChromeVersionOk = chromeVersion !== null && chromeVersion >= 127

  // Chrome version check
  const chromeReq = document.getElementById('ai-req-chrome')
  const chromeStatus = chromeReq?.querySelector('.ai-req-status')
  if (chromeStatus) {
    if (!isChrome) {
      chromeStatus.className = 'ai-req-status cross'
    } else if (isChromeVersionOk) {
      chromeStatus.className = 'ai-req-status check'
    } else {
      chromeStatus.className = 'ai-req-status cross'
    }
  }

  // Check flags individually
  const { hasPromptApi, hasModel } = await checkAIFlags()

  const promptApiReq = document.getElementById('ai-req-prompt-api')
  const modelReq = document.getElementById('ai-req-model')
  const restartReq = document.getElementById('ai-req-restart')

  const promptApiStatus = promptApiReq?.querySelector('.ai-req-status')
  const modelStatus = modelReq?.querySelector('.ai-req-status')
  const restartStatus = restartReq?.querySelector('.ai-req-status')

  // Prompt API flag check
  if (promptApiStatus) {
    promptApiStatus.className = hasPromptApi ? 'ai-req-status check' : 'ai-req-status cross'
  }

  // Model flag check
  if (modelStatus) {
    modelStatus.className = hasModel ? 'ai-req-status check' : 'ai-req-status cross'
  }

  // Restart check - if we have the API, restart was done
  if (restartStatus) {
    if (hasPromptApi) {
      restartStatus.className = 'ai-req-status check'
    } else if (isChromeVersionOk) {
      restartStatus.className = 'ai-req-status unknown'
    } else {
      restartStatus.className = 'ai-req-status cross'
    }
  }
}

function setupAIRequirementsLinks() {
  const links = document.querySelectorAll('.ai-req-link')
  links.forEach(link => {
    link.addEventListener('click', () => {
      const url = link.getAttribute('data-url')
      if (url) {
        copyToClipboard(url)
        showToast('URL copied - paste in address bar')
      }
    })
  })
}

async function initAI() {
  aiAvailable = await checkAIAvailability()

  // Update status indicators
  await updateAIRequirementsStatus()

  // Setup click handlers for links
  setupAIRequirementsLinks()

  // Show AI requirements in help modal if AI is not available
  if (!aiAvailable) {
    aiRequirements.classList.remove('hidden')
  } else {
    aiRequirements.classList.add('hidden')
  }
}

// ============ EXPAND / COLLAPSE ============

function expandAll() {
  const toggles = jsonTree.querySelectorAll('.toggle')
  const children = jsonTree.querySelectorAll('.children')
  const brackets = jsonTree.querySelectorAll('.bracket')

  toggles.forEach(toggle => { toggle.textContent = '▼' })
  children.forEach(child => { child.classList.remove('collapsed') })
  brackets.forEach(bracket => { bracket.classList.remove('collapsed') })
}

function collapseAll() {
  const toggles = jsonTree.querySelectorAll('.toggle')
  const children = jsonTree.querySelectorAll('.children')
  const brackets = jsonTree.querySelectorAll('.tree-line .bracket:first-of-type')

  toggles.forEach(toggle => { toggle.textContent = '▶' })
  children.forEach(child => { child.classList.add('collapsed') })
  brackets.forEach(bracket => { bracket.classList.add('collapsed') })
}

// ============ MODE TOGGLE ============

function setEditorMode() {
  editorModeBtn.classList.add('active')
  diffModeBtn.classList.remove('active')
  editorView.classList.remove('hidden')
  diffView.classList.add('hidden')
}

function setDiffMode() {
  diffModeBtn.classList.add('active')
  editorModeBtn.classList.remove('active')
  diffView.classList.remove('hidden')
  editorView.classList.add('hidden')
}

// ============ MAIN HANDLERS ============

function handleInput() {
  const result = parseJson(jsonInput.value)
  updateStatus(result)
  updateSyntaxHighlight(jsonInput, syntaxHighlight)
  updateLineNumbers(jsonInput, lineNumbers)

  if (!jsonInput.value.trim()) {
    showEmpty()
    updateStats(undefined)
    return
  }

  if (result.valid && result.data !== undefined) {
    renderTree(result.data)
    updateStats(result.data)
    clearSearch()
    if (searchInput.value) {
      performSearch(searchInput.value)
    }
  } else if (result.error) {
    showError(result.error)
    updateStats(undefined)
  }

  saveToStorage()
}

function formatJson() {
  const result = parseJson(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    jsonInput.value = JSON.stringify(result.data, null, 2)
    handleInput()
    showToast('JSON formatted')
  }
}

function minifyJson() {
  const result = parseJson(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    jsonInput.value = JSON.stringify(result.data)
    handleInput()
    showToast('JSON minified')
  }
}

function clearInput() {
  jsonInput.value = ''
  handleInput()
  localStorage.removeItem(STORAGE_KEY)
}

// ============ KEYBOARD SHORTCUTS ============

function handleKeyboardShortcuts(e: KeyboardEvent) {
  const isInInput = document.activeElement?.tagName === 'INPUT' ||
                    document.activeElement?.tagName === 'TEXTAREA'

  // Escape - close modals or clear search (works everywhere)
  if (e.key === 'Escape') {
    if (!aiPanel.classList.contains('hidden')) {
      aiPanel.classList.add('hidden')
      return
    }
    if (!urlModal.classList.contains('hidden')) {
      closeUrlModal()
      return
    }
    if (!shortcutsModal.classList.contains('hidden')) {
      shortcutsModal.classList.add('hidden')
      return
    }
    if (searchInput.value) {
      clearSearch()
      searchInput.blur()
      return
    }
    // Blur any focused input
    if (isInInput) {
      (document.activeElement as HTMLElement).blur()
      return
    }
  }

  // Search navigation when in search input
  if (document.activeElement === searchInput) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextMatch()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      prevMatch()
      return
    }
  }

  // All shortcuts below only work when NOT in an input field
  if (isInInput) return

  switch (e.key) {
    case '?':
      e.preventDefault()
      shortcutsModal.classList.remove('hidden')
      break
    case '/':
      e.preventDefault()
      searchInput.focus()
      break
    case 'f':
      e.preventDefault()
      formatJson()
      break
    case 'm':
      e.preventDefault()
      minifyJson()
      break
    case 'c':
      e.preventDefault()
      copyToClipboard(jsonInput.value)
      break
    case 's':
      e.preventDefault()
      downloadJson()
      break
    case 't':
      e.preventDefault()
      toggleTheme()
      break
    case 'd':
      e.preventDefault()
      if (editorView.classList.contains('hidden')) {
        setEditorMode()
      } else {
        setDiffMode()
      }
      break
    case 'e':
      e.preventDefault()
      expandAll()
      break
    case 'w':
      e.preventDefault()
      collapseAll()
      break
    case 'x':
      e.preventDefault()
      clearInput()
      break
    case 'a':
      e.preventDefault()
      toggleAIPanel()
      break
  }
}

// ============ RESIZER ============

let isResizing = false

resizer.addEventListener('mousedown', (e) => {
  isResizing = true
  resizer.classList.add('dragging')
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return

  const containerRect = editorView.getBoundingClientRect()
  const newWidth = e.clientX - containerRect.left
  const minWidth = 200
  const maxWidth = containerRect.width - 200

  if (newWidth >= minWidth && newWidth <= maxWidth) {
    leftPane.style.width = `${newWidth}px`
  }
})

document.addEventListener('mouseup', () => {
  isResizing = false
  resizer.classList.remove('dragging')
})

// ============ EVENT LISTENERS ============

// Editor
jsonInput.addEventListener('input', handleInput)
jsonInput.addEventListener('scroll', () => syncScroll(jsonInput, syntaxHighlight, lineNumbers))

// Diff mode editors
diffInputLeft.addEventListener('input', () => {
  updateSyntaxHighlight(diffInputLeft, diffHighlightLeft)
  updateLineNumbers(diffInputLeft, diffLineNumbersLeft)
  renderDiff()
})
diffInputLeft.addEventListener('scroll', () => syncScroll(diffInputLeft, diffHighlightLeft, diffLineNumbersLeft))

diffInputRight.addEventListener('input', () => {
  updateSyntaxHighlight(diffInputRight, diffHighlightRight)
  updateLineNumbers(diffInputRight, diffLineNumbersRight)
  renderDiff()
})
diffInputRight.addEventListener('scroll', () => syncScroll(diffInputRight, diffHighlightRight, diffLineNumbersRight))

// Toolbar buttons
formatBtn.addEventListener('click', formatJson)
minifyBtn.addEventListener('click', minifyJson)
copyBtn.addEventListener('click', () => copyToClipboard(jsonInput.value))
downloadBtn.addEventListener('click', downloadJson)
urlBtn.addEventListener('click', openUrlModal)
shareBtn.addEventListener('click', shareViaUrl)
clearBtn.addEventListener('click', clearInput)
expandAllBtn.addEventListener('click', expandAll)
collapseAllBtn.addEventListener('click', collapseAll)
themeBtn.addEventListener('click', toggleTheme)

// Mode toggle
editorModeBtn.addEventListener('click', setEditorMode)
diffModeBtn.addEventListener('click', setDiffMode)

// Search
searchInput.addEventListener('input', () => performSearch(searchInput.value))
searchPrev.addEventListener('click', prevMatch)
searchNext.addEventListener('click', nextMatch)
searchClear.addEventListener('click', clearSearch)

// URL Modal
urlModalClose.addEventListener('click', closeUrlModal)
urlFetchBtn.addEventListener('click', fetchFromUrl)
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchFromUrl()
})
urlModal.addEventListener('click', (e) => {
  if (e.target === urlModal) closeUrlModal()
})

// Shortcuts Modal
shortcutsModalClose.addEventListener('click', () => shortcutsModal.classList.add('hidden'))
shortcutsModal.addEventListener('click', (e) => {
  if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden')
})

// Help Button
helpBtn.addEventListener('click', () => shortcutsModal.classList.remove('hidden'))

// AI Panel
aiBtn.addEventListener('click', toggleAIPanel)
aiPanelClose.addEventListener('click', () => aiPanel.classList.add('hidden'))
aiSend.addEventListener('click', sendAIMessage)
aiInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendAIMessage()
  }
})

// Keyboard shortcuts
document.addEventListener('keydown', handleKeyboardShortcuts)

// ============ INITIALIZATION ============

loadTheme()
loadFromUrl()
initAI()

if (!loadFromStorage()) {
  // Load sample JSON for demo
  const sampleJson = {
    "name": "JSON Parser",
    "version": "1.0.0",
    "features": ["validation", "tree view", "expand/collapse", "syntax highlighting", "search", "diff"],
    "settings": {
      "theme": "dark",
      "autoFormat": true,
      "maxDepth": null
    },
    "stats": {
      "users": 1250,
      "active": true
    }
  }
  jsonInput.value = JSON.stringify(sampleJson, null, 2)
}

handleInput()
showEmpty()
handleInput()
