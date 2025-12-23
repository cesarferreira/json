import './style.css'
import { marked } from 'marked'
import yaml from 'js-yaml'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
})

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]
type DataFormat = 'json' | 'yaml'

interface ParseResult {
  valid: boolean
  data?: JsonValue
  error?: string
  format?: DataFormat
}

// Track current format
let currentFormat: DataFormat = 'json'

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
const STORAGE_KEY = 'parsy-data'
const THEME_KEY = 'parsy-theme'
const PANE_WIDTH_KEY = 'parsy-pane-width'

// DOM Elements - Editor Mode
const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement
const syntaxHighlight = document.getElementById('syntax-highlight') as HTMLPreElement
const lineNumbers = document.getElementById('line-numbers') as HTMLDivElement
const jsonTree = document.getElementById('json-tree') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const statsEl = document.getElementById('stats') as HTMLSpanElement
const formatBadge = document.getElementById('format-badge') as HTMLSpanElement

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

// DOM Elements - View Toggle
const treeViewBtn = document.getElementById('tree-view-btn') as HTMLButtonElement
const columnViewBtn = document.getElementById('column-view-btn') as HTMLButtonElement
const columnViewEl = document.getElementById('column-view') as HTMLDivElement

// DOM Elements - Other
const resizer = document.getElementById('resizer') as HTMLDivElement
const leftPane = document.querySelector('.left-pane') as HTMLDivElement
const toast = document.getElementById('toast') as HTMLDivElement
const helpBtn = document.getElementById('help-btn') as HTMLButtonElement

// State
let activeView: 'tree' | 'column' = 'tree'
let columnSelectedPath: string[] = []
let searchMatches: HTMLElement[] = []
let currentMatchIndex = -1
let currentPath = ''
let pathTimeout: number | null = null
let aiSession: any = null
let aiAvailable = false

// ============ UTILITY FUNCTIONS ============

function detectFormat(text: string): DataFormat {
  const trimmed = text.trim()
  // JSON starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json'
  }
  // Everything else is treated as YAML
  return 'yaml'
}

function parseData(text: string): ParseResult {
  if (!text.trim()) {
    return { valid: false, format: 'json' }
  }

  const format = detectFormat(text)
  currentFormat = format

  try {
    let data: JsonValue
    if (format === 'json') {
      data = JSON.parse(text)
    } else {
      // Normalize YAML:
      // - Normalize line endings (Windows CRLF to LF)
      // - Convert tabs to 2 spaces (YAML requires spaces for indentation)
      // - Remove non-breaking spaces and other invisible characters
      // - Remove trailing whitespace from lines
      const normalizedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, '  ')
        .replace(/\u00A0/g, ' ')  // Non-breaking space
        .replace(/\u2003/g, ' ')  // Em space
        .replace(/\u2002/g, ' ')  // En space
        .replace(/\u2009/g, ' ')  // Thin space
        .replace(/[ \t]+$/gm, '') // Trailing whitespace per line
      data = yaml.load(normalizedText) as JsonValue
    }
    return { valid: true, data, format }
  } catch (e) {
    const error = e as Error
    return { valid: false, error: error.message, format }
  }
}

// Alias for backward compatibility
function parseJson(text: string): ParseResult {
  return parseData(text)
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

function highlightYaml(text: string): string {
  if (!text) return ''

  const lines = text.split('\n')
  const result: string[] = []

  for (const line of lines) {
    let highlighted = ''
    let i = 0

    // Check for comment
    const commentIndex = line.indexOf('#')
    const lineContent = commentIndex >= 0 ? line.slice(0, commentIndex) : line
    const comment = commentIndex >= 0 ? line.slice(commentIndex) : ''

    // Process line content
    while (i < lineContent.length) {
      const char = lineContent[i]

      // Handle leading whitespace
      if (i === 0 || (i > 0 && /^\s*$/.test(lineContent.slice(0, i)))) {
        if (/\s/.test(char)) {
          highlighted += char
          i++
          continue
        }
      }

      // Array item marker
      if (char === '-' && (i === 0 || /^\s*$/.test(lineContent.slice(0, i)))) {
        highlighted += `<span class="hl-punctuation">-</span>`
        i++
        continue
      }

      // Check for key: value pattern
      const restOfLine = lineContent.slice(i)
      const keyMatch = restOfLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/)
      if (keyMatch) {
        highlighted += `<span class="hl-key">${escapeHtml(keyMatch[1])}</span>`
        i += keyMatch[1].length
        // Add the colon
        while (i < lineContent.length && lineContent[i] !== ':') i++
        if (lineContent[i] === ':') {
          highlighted += `<span class="hl-punctuation">:</span>`
          i++
        }
        // Skip whitespace after colon
        while (i < lineContent.length && /\s/.test(lineContent[i])) {
          highlighted += lineContent[i]
          i++
        }
        // Now parse the value
        const value = lineContent.slice(i).trim()
        if (value) {
          highlighted += highlightYamlValue(lineContent.slice(i))
          break
        }
        continue
      }

      // If we're here, it's likely a value or continuation
      highlighted += highlightYamlValue(lineContent.slice(i))
      break
    }

    // Add comment if present
    if (comment) {
      highlighted += `<span class="hl-comment">${escapeHtml(comment)}</span>`
    }

    result.push(highlighted)
  }

  return result.join('\n')
}

function highlightYamlValue(value: string): string {
  const trimmed = value.trim()
  const leadingSpace = value.match(/^\s*/)?.[0] || ''

  // Quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return leadingSpace + `<span class="hl-string">${escapeHtml(trimmed)}</span>`
  }

  // Booleans
  if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) {
    return leadingSpace + `<span class="hl-boolean">${escapeHtml(trimmed)}</span>`
  }

  // Null
  if (/^(null|~)$/i.test(trimmed)) {
    return leadingSpace + `<span class="hl-null">${escapeHtml(trimmed)}</span>`
  }

  // Numbers
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
    return leadingSpace + `<span class="hl-number">${escapeHtml(trimmed)}</span>`
  }

  // Unquoted strings
  return leadingSpace + `<span class="hl-string">${escapeHtml(trimmed)}</span>`
}

function updateSyntaxHighlight(textarea: HTMLTextAreaElement, highlight: HTMLPreElement) {
  const text = textarea.value
  const format = detectFormat(text)
  const highlighted = format === 'json' ? highlightJson(text) : highlightYaml(text)
  highlight.innerHTML = highlighted + '\n'
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

// ============ COLUMN VIEW ============

function getValueAtPath(data: JsonValue, pathParts: string[]): JsonValue | undefined {
  let current: JsonValue = data
  for (const part of pathParts) {
    if (current === null || typeof current !== 'object') return undefined
    if (Array.isArray(current)) {
      const index = parseInt(part, 10)
      if (isNaN(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
    } else {
      if (!(part in current)) return undefined
      current = (current as JsonObject)[part]
    }
  }
  return current
}

function createColumnItem(
  key: string | number,
  value: JsonValue,
  path: string[],
  isSelected: boolean
): HTMLElement {
  const item = document.createElement('div')
  item.className = `column-item${isSelected ? ' selected' : ''}`
  item.dataset.path = JSON.stringify(path)

  const left = document.createElement('div')
  left.className = 'column-item-left'

  const type = getType(value)
  const isExpandable = type === 'object' || type === 'array'

  if (typeof key === 'number') {
    const indexSpan = document.createElement('span')
    indexSpan.className = 'column-item-index'
    indexSpan.textContent = `[${key}]`
    left.appendChild(indexSpan)
  } else {
    const keySpan = document.createElement('span')
    keySpan.className = 'column-item-key'
    keySpan.textContent = key
    left.appendChild(keySpan)
  }

  if (!isExpandable) {
    const valueSpan = document.createElement('span')
    valueSpan.className = `column-item-value ${type}`
    if (type === 'string') {
      valueSpan.textContent = `"${escapeHtml(value as string)}"`
    } else if (type === 'null') {
      valueSpan.textContent = 'null'
    } else {
      valueSpan.textContent = String(value)
    }
    left.appendChild(valueSpan)
  } else {
    const preview = document.createElement('span')
    preview.className = 'column-item-type'
    if (type === 'array') {
      preview.textContent = `${(value as JsonArray).length} items`
    } else {
      preview.textContent = `${Object.keys(value as JsonObject).length} keys`
    }
    left.appendChild(preview)
  }

  item.appendChild(left)

  if (isExpandable) {
    const arrow = document.createElement('span')
    arrow.className = 'column-item-arrow'
    arrow.textContent = '›'
    item.appendChild(arrow)
  }

  item.addEventListener('click', () => {
    handleColumnItemClick(path, value)
  })

  return item
}

function createColumn(data: JsonValue, pathParts: string[], headerText: string): HTMLElement {
  const column = document.createElement('div')
  column.className = 'column'

  const header = document.createElement('div')
  header.className = 'column-header'
  header.textContent = headerText
  header.title = headerText
  column.appendChild(header)

  const content = document.createElement('div')
  content.className = 'column-content'

  const type = getType(data)

  if (type === 'object') {
    const obj = data as JsonObject
    const keys = Object.keys(obj)
    if (keys.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'column-empty'
      empty.textContent = 'Empty object'
      content.appendChild(empty)
    } else {
      keys.forEach(key => {
        const itemPath = [...pathParts, key]
        const isSelected = columnSelectedPath.length > pathParts.length &&
          columnSelectedPath[pathParts.length] === key
        content.appendChild(createColumnItem(key, obj[key], itemPath, isSelected))
      })
    }
  } else if (type === 'array') {
    const arr = data as JsonArray
    if (arr.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'column-empty'
      empty.textContent = 'Empty array'
      content.appendChild(empty)
    } else {
      arr.forEach((item, index) => {
        const itemPath = [...pathParts, String(index)]
        const isSelected = columnSelectedPath.length > pathParts.length &&
          columnSelectedPath[pathParts.length] === String(index)
        content.appendChild(createColumnItem(index, item, itemPath, isSelected))
      })
    }
  } else {
    const empty = document.createElement('div')
    empty.className = 'column-empty'
    empty.textContent = type === 'null' ? 'null' : String(data)
    content.appendChild(empty)
  }

  column.appendChild(content)
  return column
}

function handleColumnItemClick(path: string[], _value: JsonValue): void {
  columnSelectedPath = path

  // Show path display
  const pathStr = '$' + path.map((p) => {
    if (/^\d+$/.test(p)) return `[${p}]`
    return `.${p}`
  }).join('')
  showPath(pathStr)

  // Re-render column view
  const result = parseData(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    renderColumnView(result.data)
  }
}

function renderColumnView(data: JsonValue): void {
  columnViewEl.innerHTML = ''

  // Always show root column
  const rootType = getType(data)
  if (rootType !== 'object' && rootType !== 'array') {
    const empty = document.createElement('div')
    empty.className = 'column-empty'
    empty.textContent = rootType === 'null' ? 'null' : String(data)
    columnViewEl.appendChild(empty)
    return
  }

  // Create root column
  const rootHeader = rootType === 'array' ? `Array (${(data as JsonArray).length})` : `Object (${Object.keys(data as JsonObject).length})`
  columnViewEl.appendChild(createColumn(data, [], rootHeader))

  // Create columns for selected path
  let currentData: JsonValue = data
  for (let i = 0; i < columnSelectedPath.length; i++) {
    const pathSoFar = columnSelectedPath.slice(0, i + 1)
    currentData = getValueAtPath(data, pathSoFar)!

    if (currentData === undefined) break

    const type = getType(currentData)
    if (type !== 'object' && type !== 'array') break

    const headerText = columnSelectedPath[i]
    const displayHeader = /^\d+$/.test(headerText)
      ? `[${headerText}]`
      : headerText
    columnViewEl.appendChild(createColumn(currentData, pathSoFar, displayHeader))
  }

  // Scroll to show the last column
  columnViewEl.scrollLeft = columnViewEl.scrollWidth
}

// ============ VIEW TOGGLE ============

function setTreeViewMode(): void {
  activeView = 'tree'
  treeViewBtn.classList.add('active')
  columnViewBtn.classList.remove('active')
  jsonTree.classList.remove('hidden')
  columnViewEl.classList.add('hidden')
}

function setColumnViewMode(): void {
  activeView = 'column'
  columnViewBtn.classList.add('active')
  treeViewBtn.classList.remove('active')
  columnViewEl.classList.remove('hidden')
  jsonTree.classList.add('hidden')

  // Render column view with current data
  const result = parseData(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    renderColumnView(result.data)
  }
}

function toggleViewMode(): void {
  if (activeView === 'tree') {
    setColumnViewMode()
  } else {
    setTreeViewMode()
  }
}

function showError(message: string) {
  jsonTree.innerHTML = `<div class="error-message">Error: ${escapeHtml(message)}</div>`
}

// Funny example data
const jsonExamples = [
  {
    "cat": {
      "name": "Sir Whiskers III",
      "title": "Chief Napping Officer",
      "skills": ["knocking things off tables", "3am zoomies", "ignoring humans"],
      "lives_remaining": 7,
      "mood": "plotting world domination"
    }
  },
  {
    "pizza_order": {
      "customer": "Definitely Not A Dog",
      "toppings": ["ALL the meat", "more meat", "extra meat"],
      "special_instructions": "Leave at door. Do NOT ring bell. Trust me.",
      "suspicious_barking": false
    }
  },
  {
    "developer": {
      "name": "Anonymous",
      "coffee_cups_today": 7,
      "mass_of_imposter_syndrome": "∞ kg",
      "tabs_open": 347,
      "knows_what_theyre_doing": false,
      "stack_overflow_visits": 42069
    }
  },
  {
    "meeting": {
      "title": "Quick Sync",
      "scheduled_duration": "15 minutes",
      "actual_duration": "2 hours",
      "could_have_been_email": true,
      "attendees_paying_attention": 0,
      "people_on_mute": "everyone"
    }
  },
  {
    "wifi_password": {
      "name": "YellLouderForPassword",
      "actual_password": "It's on the fridge, Karen",
      "times_asked_today": 47,
      "router_location": "behind the couch, under the cat"
    }
  },
  {
    "startup": {
      "name": "DisruptoCorp",
      "mission": "Making the world a better place through AI-powered blockchain NFTs",
      "founded": "last Tuesday",
      "valuation": "$50 billion (trust me bro)",
      "employees": [
        { "name": "Chad", "title": "CEO/Visionary/Ninja", "equity": "99%", "does_actual_work": false },
        { "name": "Everyone Else", "title": "Full-Stack Rockstar", "equity": "1% split", "does_actual_work": true }
      ],
      "products": [],
      "revenue": 0,
      "ping_pong_tables": 7,
      "office_snacks": ["artisanal kombucha", "organic kale chips", "cold brew on tap"],
      "buzzwords_per_meeting": 47,
      "investor_updates": {
        "growth": "hockey stick (any day now)",
        "burn_rate": "sustainable (we have 3 months runway)",
        "pivot_count": 12
      }
    }
  },
  {
    "rpg_character": {
      "name": "Leeroy Jenkins",
      "class": "Paladin (barely)",
      "level": 42,
      "stats": {
        "strength": 18,
        "intelligence": 3,
        "wisdom": 1,
        "charisma": 20,
        "luck": -50,
        "impulse_control": 0
      },
      "inventory": [
        { "item": "Sword of Moderate Discomfort", "damage": "2d6 + regret", "cursed": true },
        { "item": "Shield of Blame Deflection", "defense": 10, "effect": "reflects criticism" },
        { "item": "Potion of Bad Decisions", "quantity": 99, "effect": "doubles confidence, halves judgment" }
      ],
      "skills": {
        "chicken_counting": { "level": "master", "chickens_counted": 12345 },
        "plan_following": { "level": "nonexistent", "plans_followed": 0 },
        "dramatic_entrance": { "level": "legendary", "wipes_caused": 847 }
      },
      "guild_status": "banned from most",
      "famous_last_words": "At least I have chicken"
    }
  },
  {
    "airline": {
      "name": "Probably Won't Crash Airlines",
      "slogan": "Your bags are in another country",
      "flights": [
        {
          "number": "PC666",
          "from": "Somewhere",
          "to": "TBD",
          "status": "delayed (shocking)",
          "delay_reason": "the vibes are off",
          "actual_departure": "¯\\_(ツ)_/¯"
        },
        {
          "number": "PC420",
          "from": "Gate changed 5 times",
          "to": "Hopefully your destination",
          "status": "boarding (run!)",
          "seats_remaining": -3,
          "leg_room": "lol"
        }
      ],
      "amenities": {
        "wifi": { "available": true, "working": false, "price": "$49.99/minute" },
        "food": { "edible": "questionable", "identifiable": false },
        "entertainment": "crying babies surround sound"
      },
      "baggage_policy": {
        "carry_on": "must fit in microscopic overhead bin",
        "checked": "guaranteed to visit 3 continents without you",
        "fees": "yes"
      },
      "customer_service": {
        "hold_time": "∞",
        "helpfulness": null,
        "music": "same 30 second loop since 1987"
      }
    }
  }
]

const yamlExamples = [
  `# The Ultimate Todo List
todo:
  today:
    - panic about deadlines
    - drink coffee
    - pretend to work
    - more coffee
    - actual work (maybe)
    - regret life choices
  tomorrow:
    - repeat`,

  `# Honest Job Application
candidate:
  name: Overqualified Potato
  experience: 10 years of googling error messages
  skills:
    - mass_imposter_syndrome: expert
    - mass_procrastination: master
    - mass_stack_overflow: black belt
  references:
    - my mass_mom (she thinks I'm great)`,

  `# Cat's Daily Schedule
schedule:
  03:00: "run around screaming"
  03:15: "knock something off counter"
  03:30: "stare at wall (ghost patrol)"
  07:00: "demand breakfast aggressively"
  07:05: "ignore breakfast"
  12:00: "nap on laptop keyboard"
  18:00: "dinner tantrum"
  23:00: "become possessed"`,

  `# Honest Recipe
recipe:
  name: "Cereal"
  difficulty: "Michelin Star"
  prep_time: "3 seconds"
  cook_time: "0 seconds"
  ingredients:
    - cereal: "whatever's not stale"
    - milk: "smell test required"
  steps:
    - pour cereal
    - add milk
    - question your life choices
    - eat over sink like a goblin`,

  `# Smart Home Status
home:
  lights:
    living_room: "flickering ominously"
    bathroom: "controlled by ghost"
  thermostat:
    set_to: 72
    actual_temp: "who knows"
    last_adjusted_by: "the cat"
  alexa:
    status: "listening (always)"
    random_laugh: scheduled for 3am`,

  `# Dungeons & Dragons Campaign
campaign:
  name: "The Curse of the Missing Snacks"
  dungeon_master: "Kevin (power trip enthusiast)"
  session_zero_promises:
    - "This will be a serious campaign"
    - "No murder hobos"
    - "We'll play every week"
  session_zero_reality:
    serious_campaign: false
    murder_hobos: "immediately"
    sessions_actually_played: 3

  party:
    - name: "Stabitha"
      class: "Rogue"
      alignment: "Chaotic Gremlin"
      backstory: "orphan (obviously)"
      has_stolen_from_party: true
      times_caught: 0

    - name: "Fireball McBlasty"
      class: "Wizard"
      alignment: "Chaotic Stupid"
      spell_slots_remaining: 0
      fireballs_cast_indoors: 47
      buildings_destroyed: 12

    - name: "Sir Healz-a-Lot"
      class: "Cleric"
      alignment: "Lawful Tired"
      healing_potions_wasted_on_rogue: 89
      considering_letting_party_die: true

    - name: "Edge McEdgelord"
      class: "Warlock"
      patron: "definitely not suspicious"
      backstory_length: "47 pages single-spaced"
      times_brooded_in_corner: infinity

  total_nat_ones: 847
  snacks_consumed: "all of them"
  next_session: "when schedules align (never)"`,

  `# Corporate Software Project
project:
  name: "Project Phoenix Rising 2.0 Turbo"
  original_deadline: "Q1 2023"
  current_deadline: "Q4 2025 (probably)"
  deadline_extensions: 12

  requirements:
    documented: false
    understood: false
    changed_last_minute: always
    source: "the CEO's nephew had an idea"

  tech_stack:
    frontend: "React (but which version? yes)"
    backend: "microservices (200+ and counting)"
    database: "MongoDB (for everything, even relational data)"
    deployment: "works on my machine"

  team:
    developers:
      - name: "Senior Dev"
        status: "burned out"
        coffee_consumed: "IV drip"
        wants_to_quit: "desperately"
      - name: "Junior Dev"
        status: "mass terrified"
        stack_overflow_tabs_open: 847
        assigned_bugs: "all of them"
      - name: "Intern"
        status: "confused"
        paid: false
        making_coffee: true
    project_manager:
      status: "making gantt charts"
      charts_consulted: 0
      standups_extended: "all of them"

  bugs:
    known: 3847
    fixed: 12
    marked_as_features: 2000
    blamed_on_users: 1835

  documentation:
    exists: "technically"
    accurate: false
    last_updated: "2019"

  production_incidents:
    this_week: 7
    blamed_on_dns: 6
    actually_dns: 1`,

  `# Dating App Profile (Honest Version)
profile:
  basics:
    name: "Average Human Person"
    age: "29 (for the 5th year)"
    height: "5'10 (with good posture and platform shoes)"
    location: "10 miles away (actually 47)"

  photos:
    - type: "main"
      features: "sunglasses, hat, and beard hiding 90% of face"
      taken: "2017"
    - type: "group"
      you_are: "the short one in back, maybe?"
    - type: "adventure"
      context: "that one time I went outside"
      will_repeat: false
    - type: "pet"
      actual_owner: "roommate"

  bio:
    claims:
      - "love to laugh (groundbreaking)"
      - "fluent in sarcasm"
      - "looking for partner in crime"
      - "not here for hookups (unless attractive)"
    reality:
      - "watches TV"
      - "mildly amusing at best"
      - "needs someone to watch TV with"
      - "standards flexible"

  interests:
    listed:
      - hiking
      - traveling
      - trying new restaurants
      - working out
    actual:
      - walking to fridge
      - google street view
      - ordering same thing everywhere
      - lifting remote

  looking_for:
    height_requirement: "taller than me (I'm 5'2)"
    must_love: "dogs (I don't have one)"
    dealbreakers:
      - "no sense of humor"
      - "doesn't like The Office"
      - "uses incorrect your/you're"
    will_actually_swipe_right_on: "anyone at this point"

  messaging_style:
    opener: "hey"
    follow_up: "hey" (3 days later)
    conversation_skills: null`
]

function loadRandomJsonExample() {
  const example = jsonExamples[Math.floor(Math.random() * jsonExamples.length)]
  jsonInput.value = JSON.stringify(example, null, 2)
  handleInput()
}

function loadRandomYamlExample() {
  const example = yamlExamples[Math.floor(Math.random() * yamlExamples.length)]
  jsonInput.value = example.trim()
  handleInput()
}

function showEmpty() {
  jsonTree.innerHTML = `
    <div class="empty-state">
      <p>Paste JSON or YAML on the left to visualize</p>
      <div class="empty-state-actions">
        <button id="load-json-example" class="example-btn">Load JSON Example</button>
        <button id="load-yaml-example" class="example-btn">Load YAML Example</button>
      </div>
    </div>
  `

  document.getElementById('load-json-example')?.addEventListener('click', loadRandomJsonExample)
  document.getElementById('load-yaml-example')?.addEventListener('click', loadRandomYamlExample)
}

function updateStatus(result: ParseResult, el: HTMLSpanElement = statusEl) {
  if (!result.valid && !result.error) {
    el.textContent = ''
    el.className = 'status'
    return
  }

  const formatLabel = (result.format || currentFormat).toUpperCase()
  if (result.valid) {
    el.textContent = `Valid ${formatLabel}`
    el.className = 'status valid'
  } else {
    el.textContent = `Invalid ${formatLabel}`
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
  const result = parseData(jsonInput.value)
  if (!result.valid) {
    showToast(`Invalid ${currentFormat.toUpperCase()}`, 'error')
    return
  }

  let content: string
  let mimeType: string
  let filename: string

  if (currentFormat === 'yaml') {
    content = yaml.dump(result.data, { indent: 2, lineWidth: -1 })
    mimeType = 'application/x-yaml'
    filename = 'data.yaml'
  } else {
    content = JSON.stringify(result.data, null, 2)
    mimeType = 'application/json'
    filename = 'data.json'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  showToast(`${currentFormat.toUpperCase()} downloaded`)
}

function shareViaUrl() {
  const text = jsonInput.value.trim()
  if (!text) {
    showToast(`No ${currentFormat.toUpperCase()} to share`, 'error')
    return
  }

  try {
    const compressed = btoa(encodeURIComponent(text))
    const formatParam = currentFormat !== 'json' ? `&format=${currentFormat}` : ''
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}${formatParam}`

    if (url.length > 2000) {
      showToast('Data too large to share via URL', 'error')
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
  const format = params.get('format') as DataFormat | null

  if (data) {
    try {
      const decoded = decodeURIComponent(atob(data))
      // Set format before loading to ensure proper handling
      if (format === 'yaml') {
        currentFormat = 'yaml'
      }
      jsonInput.value = decoded
      handleInput()
      // Clear the URL parameter
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      console.error('Failed to load data from URL')
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

type AIStatus = 'unavailable' | 'downloadable' | 'downloading' | 'available'
let aiStatus: AIStatus = 'unavailable'

async function checkAIAvailability(): Promise<boolean> {
  try {
    // Check for the LanguageModel API (new namespace) or ai.languageModel (old namespace)
    const languageModel = (window as any).LanguageModel || (window as any).ai?.languageModel
    console.log('[AI] Checking availability, languageModel:', languageModel)
    if (!languageModel) {
      console.log('[AI] No languageModel found')
      aiStatus = 'unavailable'
      return false
    }

    const availability = await languageModel.availability({ expectedOutputLanguages: ['en'] })
    console.log('[AI] Availability:', availability)
    aiStatus = availability as AIStatus
    updateAIButtonStatus()
    return availability === 'available' || availability === 'downloadable' || availability === 'downloading'
  } catch (e) {
    console.error('[AI] Availability check error:', e)
    aiStatus = 'unavailable'
    return false
  }
}

function updateAIButtonStatus() {
  const glow = document.querySelector('.ai-fab-glow') as HTMLElement
  switch (aiStatus) {
    case 'available':
      aiBtn.title = 'Private AI - runs offline (a)'
      aiBtn.classList.remove('ai-downloading')
      if (glow) glow.style.opacity = '0.8'
      break
    case 'downloadable':
      aiBtn.title = 'Click to download offline AI model'
      aiBtn.classList.remove('ai-downloading')
      if (glow) glow.style.opacity = '0.5'
      break
    case 'downloading':
      aiBtn.title = 'Downloading offline AI model...'
      aiBtn.classList.add('ai-downloading')
      if (glow) glow.style.opacity = '1'
      break
    default:
      aiBtn.title = 'Private AI not available'
      aiBtn.classList.remove('ai-downloading')
      if (glow) glow.style.opacity = '0.3'
  }
}

async function initAISession(showProgress = false) {
  try {
    console.log('[AI] Creating session... (status:', aiStatus, ')')
    const languageModel = (window as any).LanguageModel || (window as any).ai?.languageModel

    if (aiStatus === 'downloadable' || aiStatus === 'downloading') {
      aiStatus = 'downloading'
      updateAIButtonStatus()
      if (showProgress) {
        addAIMessage('Downloading AI model... This may take a few minutes.', 'system')
      }
    }

    const monitor = (m: any) => {
      console.log('[AI] Download progress:', m.loaded, '/', m.total)
      if (showProgress && m.total > 0) {
        const pct = Math.round((m.loaded / m.total) * 100)
        const progressEl = aiMessages.querySelector('.ai-download-progress')
        if (progressEl) {
          progressEl.textContent = `Downloading AI model... ${pct}%`
        }
      }
    }

    aiSession = await languageModel.create({
      systemPrompt: `You help users explore JSON and YAML data. Answer in plain English.
After your answer, write "Source:" followed by the data path.
Example answer: "The theme is dark. Source: settings.theme"
Keep answers short.`,
      expectedOutputLanguages: ['en'],
      monitor
    })

    console.log('[AI] Session created:', aiSession)
    aiStatus = 'available'
    updateAIButtonStatus()

    // Remove download message if present
    const downloadMsg = aiMessages.querySelector('.ai-download-progress')
    if (downloadMsg) downloadMsg.remove()

    return true
  } catch (e) {
    console.error('[AI] Failed to create session:', e)
    aiStatus = 'unavailable'
    updateAIButtonStatus()
    return false
  }
}

function makePathsClickable(element: HTMLElement) {
  // First handle code elements
  const codeElements = element.querySelectorAll('code')
  codeElements.forEach(code => {
    const text = code.textContent || ''
    // Check if it looks like a JSON path - must contain a dot, bracket, or start with $
    // Include hyphens since YAML/JSON keys can contain them (e.g., "calling-birds")
    const looksLikePath = /^[$\w-][\w.\-[\]0-9]*$/.test(text) &&
                          (text.includes('.') || text.includes('[') || text.startsWith('$'))
    if (looksLikePath && text.length > 1) {
      code.classList.add('json-path-link')
      code.title = `Go to ${text}`
      code.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        navigateToJsonPath(text)
      })
    }
  })

  // Also scan plain text for path patterns after "Source:" or paths with dots
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text)) {
    textNodes.push(node)
  }

  // Pattern 1: "Source: path.to.value" - specifically look for Source: prefix
  // Pattern 2: paths with dots like "settings.theme" but only if they have 2+ segments
  // Note: Include hyphens in patterns since YAML/JSON keys can contain them (e.g., "calling-birds")
  const sourcePattern = /Source:\s*([\w-][\w.\-[\]0-9]*)/gi
  const pathPattern = /\b([\w-]+\.[\w.\-[\]0-9]+)\b/g

  textNodes.forEach(textNode => {
    const text = textNode.textContent || ''
    const parent = textNode.parentNode
    if (!parent || parent.nodeName === 'CODE') return

    // First try to find "Source: path" pattern
    sourcePattern.lastIndex = 0
    const sourceMatch = sourcePattern.exec(text)

    if (sourceMatch) {
      const fragment = document.createDocumentFragment()
      const beforeSource = text.slice(0, sourceMatch.index).trim()
      const pathValue = sourceMatch[1]
      const afterPath = text.slice(sourceMatch.index + sourceMatch[0].length)

      if (beforeSource) {
        fragment.appendChild(document.createTextNode(beforeSource + ' '))
      }

      // Create a sub-bubble for the source
      const sourceContainer = document.createElement('span')
      sourceContainer.className = 'ai-source-bubble'

      const pathSpan = document.createElement('code')
      pathSpan.className = 'json-path-link'
      pathSpan.textContent = pathValue
      pathSpan.title = `Go to ${pathValue}`
      pathSpan.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        navigateToJsonPath(pathValue)
      })
      sourceContainer.appendChild(pathSpan)
      fragment.appendChild(sourceContainer)

      if (afterPath.trim()) {
        fragment.appendChild(document.createTextNode(afterPath))
      }

      parent.replaceChild(fragment, textNode)
      return
    }

    // Fallback: look for dotted paths like "settings.theme"
    pathPattern.lastIndex = 0
    if (!pathPattern.test(text)) return
    pathPattern.lastIndex = 0

    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pathPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }
      const pathSpan = document.createElement('code')
      pathSpan.className = 'json-path-link'
      pathSpan.textContent = match[1]
      pathSpan.title = `Go to ${match[1]}`
      pathSpan.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        navigateToJsonPath(match![1])
      })
      fragment.appendChild(pathSpan)
      lastIndex = pathPattern.lastIndex
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    if (lastIndex > 0) {
      parent.replaceChild(fragment, textNode)
    }
  })
}

function addAIMessage(content: string, type: 'user' | 'ai' | 'loading' | 'system') {
  const messageDiv = document.createElement('div')
  messageDiv.className = `ai-message ai-message-${type}`

  if (type === 'loading') {
    messageDiv.textContent = 'Thinking'
  } else if (type === 'system' && content.includes('Downloading')) {
    messageDiv.classList.add('ai-download-progress')
    messageDiv.textContent = content
  } else if (type === 'ai') {
    // Render markdown for AI responses
    messageDiv.innerHTML = marked.parse(content) as string
    // Make JSON paths clickable
    makePathsClickable(messageDiv)
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

// Extract JSON structure (keys and types only) for large files
function extractJsonStructure(data: JsonValue, maxDepth = 3, currentDepth = 0): string {
  if (currentDepth >= maxDepth) {
    return Array.isArray(data) ? '[...]' : typeof data === 'object' && data !== null ? '{...}' : String(typeof data)
  }

  if (data === null) return 'null'
  if (typeof data !== 'object') return typeof data

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]'
    // Show first item structure and count
    const firstItem = extractJsonStructure(data[0], maxDepth, currentDepth + 1)
    return `[${firstItem}] (${data.length} items)`
  }

  const entries = Object.entries(data)
  if (entries.length === 0) return '{}'

  const fields = entries.slice(0, 20).map(([key, value]) => {
    const valueType = extractJsonStructure(value, maxDepth, currentDepth + 1)
    return `  "${key}": ${valueType}`
  })

  if (entries.length > 20) {
    fields.push(`  ... and ${entries.length - 20} more fields`)
  }

  return `{\n${fields.join(',\n')}\n}`
}

// Check if prompt fits in context window, returns { fits: boolean, usage: number, quota: number }
async function checkPromptFits(session: any, promptText: string): Promise<{ fits: boolean; usage: number; quota: number; available: number }> {
  try {
    const inputQuota = session.inputQuota || 6144 // Default Gemini Nano context
    const inputUsage = session.inputUsage || 0

    // Use measureInputUsage if available (newer API)
    let promptTokens = 0
    if (typeof session.measureInputUsage === 'function') {
      promptTokens = await session.measureInputUsage(promptText)
    } else if (typeof session.countPromptTokens === 'function') {
      // Fallback to older API
      promptTokens = await session.countPromptTokens(promptText)
    } else {
      // Rough estimate: ~4 chars per token
      promptTokens = Math.ceil(promptText.length / 4)
    }

    const available = inputQuota - inputUsage
    console.log(`[AI] Token check: prompt=${promptTokens}, used=${inputUsage}, quota=${inputQuota}, available=${available}`)

    return {
      fits: promptTokens <= available,
      usage: promptTokens,
      quota: inputQuota,
      available
    }
  } catch (e) {
    console.warn('[AI] Could not measure tokens:', e)
    // Default to allowing if we can't measure
    return { fits: true, usage: 0, quota: 6144, available: 6144 }
  }
}

// Build a smaller prompt using JSON structure instead of full data
function buildStructurePrompt(jsonData: string, question: string, format: string): string {
  let parsedData: JsonValue
  try {
    parsedData = format === 'yaml' ? yaml.load(jsonData) as JsonValue : JSON.parse(jsonData)
  } catch {
    return '' // Can't parse, will fail later
  }

  const structure = extractJsonStructure(parsedData, 4)
  return `${format.toUpperCase()} structure (data too large for full context):
${structure}

Question: ${question}
Note: I can only see the structure, not all values. Answer based on the structure or ask for a specific path.
Answer (then write "Source: path.to.value if applicable"):`
}

async function sendAIMessage() {
  const question = aiInput.value.trim()
  if (!question) return

  const jsonData = jsonInput.value.trim()
  if (!jsonData) {
    showToast('No JSON data to analyze', 'error')
    return
  }

  console.log('[AI] Sending message:', question)

  // Add user message
  addAIMessage(question, 'user')
  aiInput.value = ''
  aiSend.disabled = true

  // Add loading message
  addAIMessage('', 'loading')

  try {
    // Initialize session if needed
    if (!aiSession) {
      console.log('[AI] No session, initializing...')
      const success = await initAISession(true)
      if (!success) {
        throw new Error('Failed to initialize AI')
      }
    }

    console.log('[AI] Session methods:', Object.keys(aiSession), aiSession)

    // Build the prompt with data context
    const formatLabel = currentFormat.toUpperCase()
    let promptText = `${formatLabel} data:
${jsonData}

Question: ${question}
Answer (then write "Source: path.to.value"):`

    // Check if prompt fits in context window
    const tokenCheck = await checkPromptFits(aiSession, promptText)

    if (!tokenCheck.fits) {
      console.log(`[AI] Prompt too large (${tokenCheck.usage} tokens, ${tokenCheck.available} available). Using structure-based approach.`)

      // Try structure-based prompt
      const structurePrompt = buildStructurePrompt(jsonData, question, currentFormat)
      if (structurePrompt) {
        const structureCheck = await checkPromptFits(aiSession, structurePrompt)
        if (structureCheck.fits) {
          promptText = structurePrompt
          console.log('[AI] Using structure-based prompt instead')
        } else {
          // Even structure is too big - show error
          removeLoadingMessage()
          addAIMessage(
            `The data is too large for the AI to process (${tokenCheck.usage.toLocaleString()} tokens, limit is ${tokenCheck.available.toLocaleString()}). ` +
            `Try asking about a specific path, like "What is in settings.theme?" or filter your data first.`,
            'ai'
          )
          aiSend.disabled = false
          return
        }
      }
    }

    console.log('[AI] Calling prompt with:', promptText.substring(0, 100) + '...')

    // Create message element for streaming (hidden until we get content)
    const messageDiv = document.createElement('div')
    messageDiv.className = 'ai-message ai-message-ai'
    messageDiv.style.display = 'none'
    aiMessages.appendChild(messageDiv)

    let fullResponse = ''
    let firstChunkReceived = false

    // Try streaming first, fall back to regular prompt
    if (typeof aiSession.promptStreaming === 'function') {
      console.log('[AI] Using promptStreaming() method')
      const stream = aiSession.promptStreaming(promptText)

      for await (const chunk of stream) {
        // Remove loading message on first chunk
        if (!firstChunkReceived) {
          removeLoadingMessage()
          messageDiv.style.display = ''
          firstChunkReceived = true
        }
        fullResponse += chunk // Concatenate chunks
        messageDiv.innerHTML = marked.parse(fullResponse) as string
        aiMessages.scrollTop = aiMessages.scrollHeight
      }
      // Make paths clickable after streaming completes
      makePathsClickable(messageDiv)
    } else if (typeof aiSession.prompt === 'function') {
      console.log('[AI] Using prompt() method (non-streaming)')
      fullResponse = await aiSession.prompt(promptText)
      removeLoadingMessage()
      messageDiv.style.display = ''
      messageDiv.innerHTML = marked.parse(fullResponse) as string
      makePathsClickable(messageDiv)
    } else {
      console.error('[AI] No known method found on session:', aiSession)
      throw new Error('No prompt method available')
    }

    console.log('[AI] Response complete:', fullResponse.substring(0, 100) + '...')
  } catch (e) {
    removeLoadingMessage()
    addAIMessage('Sorry, I encountered an error. Please try again.', 'ai')
    console.error('[AI] Error:', e)
  } finally {
    aiSend.disabled = false
  }
}

const aiFab = document.getElementById('ai-fab') as HTMLDivElement

function toggleAIPanel() {
  const isHidden = aiPanel.classList.contains('hidden')

  if (isHidden) {
    // Show panel, hide FAB - they swap places
    aiFab.classList.add('hidden')
    aiPanel.classList.remove('hidden')
    requestAnimationFrame(() => {
      aiPanel.classList.add('visible')
    })

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
    // Hide panel, show FAB - crossfade so button appears as panel shrinks
    aiPanel.classList.remove('visible')
    // Start showing FAB slightly before panel finishes collapsing
    setTimeout(() => {
      aiFab.classList.remove('hidden')
    }, 100)
    setTimeout(() => {
      aiPanel.classList.add('hidden')
    }, 300)
  }
}

function getGoogleChromeVersion(): number | null {
  // Use User-Agent Client Hints API (most reliable method)
  const uaData = (navigator as any).userAgentData
  if (uaData?.brands) {
    const chromeEntry = uaData.brands.find((brand: { brand: string; version: string }) =>
      brand.brand === 'Google Chrome'
    )
    if (chromeEntry) {
      return parseInt(chromeEntry.version, 10)
    }
    // If brands exist but no Google Chrome, it's a different Chromium browser
    return null
  }

  // Fallback to user agent string parsing
  const ua = navigator.userAgent

  // Check for other Chromium browsers that report as Chrome but aren't
  const isNotGoogleChrome = /Edg\/|OPR\/|Brave|Vivaldi|Arc\/|Opera|Yandex|SamsungBrowser|Chromium/i.test(ua)
  if (isNotGoogleChrome) {
    return null
  }

  // Check for actual Chrome
  const match = ua.match(/Chrome\/(\d+)/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return null
}

async function checkAIFlags(): Promise<{ hasPromptApi: boolean; hasModel: boolean }> {
  try {
    // Check for new namespace (LanguageModel) or old namespace (ai.languageModel)
    const languageModel = (window as any).LanguageModel || (window as any).ai?.languageModel
    const hasPromptApi = !!languageModel
    let hasModel = false

    if (hasPromptApi) {
      const availability = await languageModel.availability({ expectedOutputLanguages: ['en'] })
      // Model is available if it's ready, downloadable, or downloading
      hasModel = availability === 'available' ||
                 availability === 'downloadable' ||
                 availability === 'downloading'
    }

    return { hasPromptApi, hasModel }
  } catch {
    return { hasPromptApi: false, hasModel: false }
  }
}

async function updateAIRequirementsStatus() {
  const chromeVersion = getGoogleChromeVersion()
  const isGoogleChrome = chromeVersion !== null
  const isChromeVersionOk = chromeVersion !== null && chromeVersion >= 138

  // Chrome version check
  const chromeReq = document.getElementById('ai-req-chrome')
  const chromeStatus = chromeReq?.querySelector('.ai-req-status')
  if (chromeStatus) {
    if (!isGoogleChrome) {
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
  // Only show AI features on Google Chrome (Gemini Nano is Chrome-exclusive)
  const isGoogleChrome = getGoogleChromeVersion() !== null
  if (!isGoogleChrome) {
    aiFab.style.display = 'none'
    aiRequirements.classList.remove('hidden')
    return
  }

  aiAvailable = await checkAIAvailability()

  // Update status indicators
  await updateAIRequirementsStatus()

  // Setup click handlers for links
  setupAIRequirementsLinks()

  // Show AI requirements in help modal if AI is not available
  if (!aiAvailable) {
    aiRequirements.classList.remove('hidden')
    // Hide the FAB button if AI is not supported
    aiFab.style.display = 'none'
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

function navigateToJsonPath(pathStr: string) {
  console.log('[Navigate] Looking for path:', pathStr)

  // Handle ".length" - navigate to the array itself
  let cleanPath = pathStr.trim()
  if (cleanPath.endsWith('.length')) {
    cleanPath = cleanPath.replace('.length', '')
  }

  // Convert simple path like "stats.users" to full path "$.stats.users"
  let fullPath = cleanPath
  if (!fullPath.startsWith('$')) {
    fullPath = '$.' + fullPath
  }
  console.log('[Navigate] Full path:', fullPath)

  // Find the element with this path
  const allLines = jsonTree.querySelectorAll('.tree-line[data-path]')
  let targetLine: HTMLElement | null = null

  // Try exact match first
  for (const line of allLines) {
    const linePath = (line as HTMLElement).dataset.path
    if (linePath === fullPath || linePath === pathStr) {
      targetLine = line as HTMLElement
      console.log('[Navigate] Found exact match:', linePath)
      break
    }
  }

  // If not found, try matching the key name (last part of path)
  if (!targetLine) {
    const keyName = pathStr.split('.').pop() || pathStr
    for (const line of allLines) {
      const linePath = (line as HTMLElement).dataset.path || ''
      if (linePath === fullPath || linePath.endsWith('.' + keyName)) {
        targetLine = line as HTMLElement
        console.log('[Navigate] Found partial match:', linePath)
        break
      }
    }
  }

  if (targetLine) {
    // Switch to editor mode first if in diff mode
    if (!diffView.classList.contains('hidden')) {
      setEditorMode()
    }

    // Expand all parent nodes to make the target visible
    let parent = targetLine.parentElement
    while (parent && parent !== jsonTree) {
      if (parent.classList.contains('children')) {
        parent.classList.remove('collapsed')
        // Update the toggle button
        const prevSibling = parent.previousElementSibling
        if (prevSibling) {
          const toggle = prevSibling.querySelector('.toggle')
          const bracket = prevSibling.querySelector('.bracket')
          if (toggle) toggle.textContent = '▼'
          if (bracket) bracket.classList.remove('collapsed')
        }
      }
      parent = parent.parentElement
    }

    // Small delay to let DOM update after expanding
    setTimeout(() => {
      // Scroll to the element
      targetLine!.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Flash highlight effect
      targetLine!.classList.add('path-highlight')
      setTimeout(() => {
        targetLine?.classList.remove('path-highlight')
      }, 2500)
    }, 100)
  } else {
    console.log('[Navigate] Path not found. Available paths:',
      Array.from(allLines).slice(0, 10).map(l => (l as HTMLElement).dataset.path))
  }
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

function updateFormatBadge(format: DataFormat) {
  formatBadge.textContent = format.toUpperCase()
  formatBadge.classList.remove('json', 'yaml')
  formatBadge.classList.add(format)
}

function handleInput() {
  const result = parseData(jsonInput.value)
  updateStatus(result)
  updateSyntaxHighlight(jsonInput, syntaxHighlight)
  updateLineNumbers(jsonInput, lineNumbers)
  updateFormatBadge(result.format || 'json')

  if (!jsonInput.value.trim()) {
    showEmpty()
    columnViewEl.innerHTML = ''
    columnSelectedPath = []
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
    // Update column view if active
    if (activeView === 'column') {
      // Validate current selection still exists
      const currentValue = getValueAtPath(result.data, columnSelectedPath)
      if (currentValue === undefined) {
        columnSelectedPath = []
      }
      renderColumnView(result.data)
    }
  } else if (result.error) {
    showError(result.error)
    columnViewEl.innerHTML = ''
    updateStats(undefined)
  }

  saveToStorage()
}

function formatJson() {
  const result = parseData(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    if (currentFormat === 'yaml') {
      jsonInput.value = yaml.dump(result.data, { indent: 2, lineWidth: -1, noRefs: true })
      showToast('YAML formatted')
    } else {
      jsonInput.value = JSON.stringify(result.data, null, 2)
      showToast('JSON formatted')
    }
    handleInput()
  }
}

function minifyJson() {
  const result = parseData(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    if (currentFormat === 'yaml') {
      // Use flow style for compact YAML
      jsonInput.value = yaml.dump(result.data, { flowLevel: 0, lineWidth: -1 })
      showToast('YAML minified')
    } else {
      jsonInput.value = JSON.stringify(result.data)
      showToast('JSON minified')
    }
    handleInput()
  }
}

function clearInput() {
  jsonInput.value = ''
  handleInput()
  localStorage.removeItem(STORAGE_KEY)
}

// ============ KEYBOARD SHORTCUTS ============

function handleKeyboardShortcuts(e: KeyboardEvent) {
  const activeEl = document.activeElement
  const isInInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'

  // Escape - close modals or clear search (works everywhere)
  if (e.key === 'Escape') {
    if (aiPanel.classList.contains('visible')) {
      toggleAIPanel()
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
      (activeEl as HTMLElement).blur()
      return
    }
  }

  // Search navigation when in search input
  if (activeEl === searchInput) {
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
    // Don't process other shortcuts when in search
    return
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
    case 'v':
      e.preventDefault()
      toggleViewMode()
      break
    case 'a':
      e.preventDefault()
      toggleAIPanel()
      break
  }
}

// ============ RESIZER ============

let isResizing = false

function savePaneWidth() {
  const width = leftPane.getBoundingClientRect().width
  localStorage.setItem(PANE_WIDTH_KEY, String(width))
}

function loadPaneWidth() {
  const savedWidth = localStorage.getItem(PANE_WIDTH_KEY)
  if (savedWidth) {
    const width = parseInt(savedWidth, 10)
    if (width >= 200) {
      leftPane.style.width = `${width}px`
    }
  }
}

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
  if (isResizing) {
    savePaneWidth()
  }
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

// View Toggle (Tree/Column)
treeViewBtn.addEventListener('click', setTreeViewMode)
columnViewBtn.addEventListener('click', setColumnViewMode)

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
aiPanelClose.addEventListener('click', toggleAIPanel)

// Click outside to close AI panel
document.addEventListener('click', (e) => {
  if (!aiPanel.classList.contains('visible')) return
  const target = e.target as HTMLElement
  if (!aiPanel.contains(target) && !aiFab.contains(target)) {
    toggleAIPanel()
  }
})
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
loadPaneWidth()
loadFromUrl()
initAI()

if (!loadFromStorage()) {
  // Load sample JSON for demo
  const sampleJson = {
    "name": "Parsy",
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
