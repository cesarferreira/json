# AI Chatbox

A beautiful, private, offline AI chat component using Chrome's built-in Gemini Nano model.

## Features

- 🔒 **100% Private** - Runs entirely on-device, data never leaves your browser
- ✨ **Beautiful UI** - Animated floating button with customizable glow colors
- 📝 **Markdown Support** - AI responses render with full markdown formatting
- 🌊 **Streaming** - Real-time text streaming like ChatGPT
- 🎨 **Themeable** - Dark, light, or auto theme support
- 📍 **Flexible Positioning** - Center, left, or right placement

## Requirements

- Google Chrome 138+
- Enable `chrome://flags/#optimization-guide-on-device-model`
- Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
- 22GB storage, 4GB+ VRAM (or 16GB RAM)

## Installation

```bash
npm install marked
```

Copy `ai-chatbox.ts` to your project.

## Usage

### Basic Usage

```typescript
import { AIChatbox } from './lib/ai-chatbox'

const chatbox = new AIChatbox()
chatbox.mount(document.body)
```

### With Custom Context

```typescript
import { AIChatbox } from './lib/ai-chatbox'

const chatbox = new AIChatbox({
  // Provide context that gets sent with every message
  context: () => document.getElementById('editor').innerText,

  systemPrompt: 'You are a helpful code assistant. Analyze the provided code and answer questions about it.',

  welcomeMessage: 'Ask me anything about your code!'
})

chatbox.mount(document.body)
```

### Full Configuration

```typescript
import { AIChatbox } from './lib/ai-chatbox'

const chatbox = new AIChatbox({
  // Function returning context to include with messages
  context: () => myApp.getData(),

  // System prompt for the AI
  systemPrompt: 'You are analyzing JSON data. Be concise.',

  // Initial welcome message
  welcomeMessage: 'Hi! Ask me anything about your data.',

  // Theme: 'dark' | 'light' | 'auto'
  theme: 'dark',

  // Position: 'center' | 'right' | 'left'
  position: 'center',

  // Custom glow colors for the floating button
  glowColors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],

  // Callback when AI status changes
  onStatusChange: (status) => {
    console.log('AI status:', status)
    // status: 'unavailable' | 'downloadable' | 'downloading' | 'available'
  }
})

chatbox.mount(document.body)
```

## API

### `new AIChatbox(options?)`

Creates a new chatbox instance.

### `chatbox.mount(element)`

Mounts the chatbox to a DOM element.

### `chatbox.unmount()`

Removes the chatbox from the DOM.

### `chatbox.open()`

Opens the chat panel.

### `chatbox.close()`

Closes the chat panel.

### `chatbox.toggle()`

Toggles the chat panel open/closed.

## Examples

### JSON Analyzer

```typescript
const chatbox = new AIChatbox({
  context: () => document.getElementById('json-input').value,
  systemPrompt: `You are a JSON data analyst. Help users understand their JSON structure,
    find values, explain relationships, and answer questions about the data.`,
  welcomeMessage: 'Paste some JSON and ask me anything about it!'
})
```

### Code Assistant

```typescript
const chatbox = new AIChatbox({
  context: () => editor.getValue(), // Monaco/CodeMirror
  systemPrompt: `You are a code assistant. Help with debugging, explaining code,
    suggesting improvements, and answering programming questions.`,
  position: 'right'
})
```

### Document Q&A

```typescript
const chatbox = new AIChatbox({
  context: () => document.querySelector('article').innerText,
  systemPrompt: 'Answer questions about the document. Be accurate and cite specific parts.',
  theme: 'light',
  position: 'left'
})
```

## License

MIT
