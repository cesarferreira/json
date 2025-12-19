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

const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement
const jsonTree = document.getElementById('json-tree') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const statsEl = document.getElementById('stats') as HTMLSpanElement
const formatBtn = document.getElementById('format-btn') as HTMLButtonElement
const minifyBtn = document.getElementById('minify-btn') as HTMLButtonElement
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement
const expandAllBtn = document.getElementById('expand-all-btn') as HTMLButtonElement
const collapseAllBtn = document.getElementById('collapse-all-btn') as HTMLButtonElement
const resizer = document.getElementById('resizer') as HTMLDivElement
const leftPane = document.querySelector('.left-pane') as HTMLDivElement

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

function countStats(value: JsonValue): Stats {
  const stats: Stats = {
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0
  }

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
      case 'string':
        stats.strings++
        break
      case 'number':
        stats.numbers++
        break
      case 'boolean':
        stats.booleans++
        break
      case 'null':
        stats.nulls++
        break
    }
  }

  count(value)
  return stats
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function createTreeNode(key: string | number | null, value: JsonValue, isLast: boolean): HTMLElement {
  const type = getType(value)
  const node = document.createElement('div')
  node.className = 'tree-node'

  const line = document.createElement('div')
  line.className = 'tree-line'

  const isExpandable = type === 'object' || type === 'array'

  if (isExpandable) {
    const toggle = document.createElement('span')
    toggle.className = 'toggle'
    toggle.textContent = '▼'
    toggle.addEventListener('click', () => {
      const children = node.querySelector('.children') as HTMLElement
      const isCollapsed = children.classList.contains('collapsed')
      children.classList.toggle('collapsed')
      toggle.textContent = isCollapsed ? '▼' : '▶'

      const bracket = line.querySelector('.bracket') as HTMLElement
      if (bracket) {
        bracket.classList.toggle('collapsed', !isCollapsed)
      }
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

    node.appendChild(line)

    const children = document.createElement('div')
    children.className = 'children'

    keys.forEach((k, i) => {
      children.appendChild(createTreeNode(k, obj[k], i === keys.length - 1))
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

    node.appendChild(line)

    const children = document.createElement('div')
    children.className = 'children'

    arr.forEach((item, i) => {
      children.appendChild(createTreeNode(i, item, i === arr.length - 1))
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

    if (type === 'string') {
      valueSpan.textContent = `"${escapeHtml(value as string)}"`
    } else if (type === 'null') {
      valueSpan.textContent = 'null'
    } else {
      valueSpan.textContent = String(value)
    }

    if (!isLast) {
      valueSpan.textContent += ','
    }

    line.appendChild(valueSpan)
    node.appendChild(line)
  }

  return node
}

function renderTree(data: JsonValue) {
  jsonTree.innerHTML = ''
  const tree = createTreeNode(null, data, true)
  jsonTree.appendChild(tree)
}

function showError(message: string) {
  jsonTree.innerHTML = `<div class="error-message">Error: ${escapeHtml(message)}</div>`
}

function showEmpty() {
  jsonTree.innerHTML = '<div class="empty-state">Paste JSON on the left to visualize</div>'
}

function updateStatus(result: ParseResult) {
  if (!jsonInput.value.trim()) {
    statusEl.textContent = ''
    statusEl.className = 'status'
    return
  }

  if (result.valid) {
    statusEl.textContent = 'Valid JSON'
    statusEl.className = 'status valid'
  } else {
    statusEl.textContent = 'Invalid JSON'
    statusEl.className = 'status invalid'
  }
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
  if (stats.nulls > 0) parts.push(`${stats.nulls} null`)

  statsEl.textContent = parts.join(' | ')
}

function handleInput() {
  const result = parseJson(jsonInput.value)
  updateStatus(result)

  if (!jsonInput.value.trim()) {
    showEmpty()
    updateStats(undefined)
    return
  }

  if (result.valid && result.data !== undefined) {
    renderTree(result.data)
    updateStats(result.data)
  } else if (result.error) {
    showError(result.error)
    updateStats(undefined)
  }
}

function formatJson() {
  const result = parseJson(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    jsonInput.value = JSON.stringify(result.data, null, 2)
    handleInput()
  }
}

function minifyJson() {
  const result = parseJson(jsonInput.value)
  if (result.valid && result.data !== undefined) {
    jsonInput.value = JSON.stringify(result.data)
    handleInput()
  }
}

function clearInput() {
  jsonInput.value = ''
  handleInput()
}

function expandAll() {
  const toggles = jsonTree.querySelectorAll('.toggle')
  const children = jsonTree.querySelectorAll('.children')
  const brackets = jsonTree.querySelectorAll('.bracket')

  toggles.forEach(toggle => {
    toggle.textContent = '▼'
  })

  children.forEach(child => {
    child.classList.remove('collapsed')
  })

  brackets.forEach(bracket => {
    bracket.classList.remove('collapsed')
  })
}

function collapseAll() {
  const toggles = jsonTree.querySelectorAll('.toggle')
  const children = jsonTree.querySelectorAll('.children')
  const brackets = jsonTree.querySelectorAll('.tree-line .bracket:first-of-type')

  toggles.forEach(toggle => {
    toggle.textContent = '▶'
  })

  children.forEach(child => {
    child.classList.add('collapsed')
  })

  brackets.forEach(bracket => {
    bracket.classList.add('collapsed')
  })
}

// Resizer functionality
let isResizing = false

resizer.addEventListener('mousedown', (e) => {
  isResizing = true
  resizer.classList.add('dragging')
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return

  const containerRect = document.querySelector('.main')!.getBoundingClientRect()
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

// Event listeners
jsonInput.addEventListener('input', handleInput)
formatBtn.addEventListener('click', formatJson)
minifyBtn.addEventListener('click', minifyJson)
clearBtn.addEventListener('click', clearInput)
expandAllBtn.addEventListener('click', expandAll)
collapseAllBtn.addEventListener('click', collapseAll)

// Initialize with empty state
showEmpty()

// Load sample JSON for demo
const sampleJson = {
  "name": "JSON Parser",
  "version": "1.0.0",
  "features": ["validation", "tree view", "expand/collapse"],
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
handleInput()
