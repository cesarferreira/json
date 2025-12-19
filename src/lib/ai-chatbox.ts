/**
 * AI Chatbox - A private, offline AI chat component using Chrome's Gemini Nano
 *
 * Usage:
 *   import { AIChatbox } from './ai-chatbox'
 *
 *   const chatbox = new AIChatbox({
 *     context: () => document.getElementById('my-content').innerText,
 *     systemPrompt: 'You are a helpful assistant analyzing the provided content.',
 *     theme: 'dark'
 *   })
 *
 *   chatbox.mount(document.body)
 */

import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

type AIStatus = 'unavailable' | 'downloadable' | 'downloading' | 'available'

export interface AIChatboxOptions {
  /** Function that returns the context to send with each message */
  context?: () => string
  /** System prompt for the AI */
  systemPrompt?: string
  /** Initial message shown in the chat */
  welcomeMessage?: string
  /** Theme: 'dark' | 'light' | 'auto' */
  theme?: 'dark' | 'light' | 'auto'
  /** Position: 'center' | 'right' | 'left' */
  position?: 'center' | 'right' | 'left'
  /** Accent colors for the glow effect */
  glowColors?: string[]
  /** Callback when AI status changes */
  onStatusChange?: (status: AIStatus) => void
}

export class AIChatbox {
  private options: Required<AIChatboxOptions>
  private container: HTMLElement | null = null
  private fab: HTMLElement | null = null
  private panel: HTMLElement | null = null
  private messagesEl: HTMLElement | null = null
  private inputEl: HTMLInputElement | null = null
  private session: any = null
  private status: AIStatus = 'unavailable'
  private isOpen = false

  constructor(options: AIChatboxOptions = {}) {
    this.options = {
      context: options.context || (() => ''),
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      welcomeMessage: options.welcomeMessage || 'Ask me anything. This AI runs entirely on your device - your data never leaves your browser.',
      theme: options.theme || 'auto',
      position: options.position || 'center',
      glowColors: options.glowColors || ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
      onStatusChange: options.onStatusChange || (() => {})
    }
  }

  async mount(target: HTMLElement): Promise<void> {
    this.injectStyles()
    this.createElements()
    target.appendChild(this.container!)
    this.attachEventListeners()
    await this.checkAvailability()
  }

  unmount(): void {
    this.container?.remove()
    this.session?.destroy?.()
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open()
  }

  open(): void {
    if (!this.panel || !this.fab) return
    this.isOpen = true
    this.panel.classList.remove('aicb-hidden')
    requestAnimationFrame(() => this.panel!.classList.add('aicb-visible'))
    this.fab.classList.add('aicb-hidden')
    this.inputEl?.focus()
  }

  close(): void {
    if (!this.panel || !this.fab) return
    this.isOpen = false
    this.panel.classList.remove('aicb-visible')
    setTimeout(() => {
      this.panel!.classList.add('aicb-hidden')
      this.fab!.classList.remove('aicb-hidden')
    }, 300)
  }

  private async checkAvailability(): Promise<void> {
    try {
      const languageModel = (window as any).LanguageModel || (window as any).ai?.languageModel
      if (!languageModel) {
        this.setStatus('unavailable')
        return
      }
      const availability = await languageModel.availability({ expectedOutputLanguages: ['en'] })
      this.setStatus(availability as AIStatus)
    } catch {
      this.setStatus('unavailable')
    }
  }

  private setStatus(status: AIStatus): void {
    this.status = status
    this.updateFabAppearance()
    this.options.onStatusChange(status)
  }

  private updateFabAppearance(): void {
    const btn = this.fab?.querySelector('.aicb-fab-btn') as HTMLElement
    const glow = this.fab?.querySelector('.aicb-fab-glow') as HTMLElement
    if (!btn || !glow) return

    const titles: Record<AIStatus, string> = {
      available: 'Private AI - runs offline',
      downloadable: 'Click to download offline AI model',
      downloading: 'Downloading offline AI model...',
      unavailable: 'Private AI not available'
    }
    btn.title = titles[this.status]

    const opacities: Record<AIStatus, string> = {
      available: '0.8',
      downloadable: '0.5',
      downloading: '1',
      unavailable: '0.3'
    }
    glow.style.opacity = opacities[this.status]

    btn.classList.toggle('aicb-downloading', this.status === 'downloading')
  }

  private async initSession(): Promise<boolean> {
    try {
      const languageModel = (window as any).LanguageModel || (window as any).ai?.languageModel

      if (this.status === 'downloadable' || this.status === 'downloading') {
        this.setStatus('downloading')
        this.addMessage('Downloading AI model... This may take a few minutes.', 'system')
      }

      this.session = await languageModel.create({
        systemPrompt: this.options.systemPrompt,
        expectedOutputLanguages: ['en']
      })

      this.setStatus('available')
      this.removeSystemMessages()
      return true
    } catch (e) {
      console.error('[AIChatbox] Failed to create session:', e)
      this.setStatus('unavailable')
      return false
    }
  }

  private async sendMessage(): Promise<void> {
    const question = this.inputEl?.value.trim()
    if (!question) return

    const context = this.options.context()

    this.addMessage(question, 'user')
    this.inputEl!.value = ''
    this.setInputEnabled(false)

    try {
      if (!this.session) {
        const success = await this.initSession()
        if (!success) {
          this.addMessage('Failed to initialize AI. Please check requirements.', 'ai')
          return
        }
      }

      const promptText = context
        ? `Context:\n\`\`\`\n${context}\n\`\`\`\n\nQuestion: ${question}`
        : question

      const messageEl = this.addMessage('', 'ai')
      let fullResponse = ''

      if (typeof this.session.promptStreaming === 'function') {
        const stream = this.session.promptStreaming(promptText)
        for await (const chunk of stream) {
          fullResponse += chunk
          messageEl.innerHTML = marked.parse(fullResponse) as string
          this.scrollToBottom()
        }
      } else {
        fullResponse = await this.session.prompt(promptText)
        messageEl.innerHTML = marked.parse(fullResponse) as string
      }
    } catch (e) {
      console.error('[AIChatbox] Error:', e)
      this.addMessage('Sorry, I encountered an error. Please try again.', 'ai')
    } finally {
      this.setInputEnabled(true)
      this.inputEl?.focus()
    }
  }

  private addMessage(content: string, type: 'user' | 'ai' | 'system'): HTMLElement {
    const el = document.createElement('div')
    el.className = `aicb-message aicb-message-${type}`

    if (type === 'ai' && content) {
      el.innerHTML = marked.parse(content) as string
    } else {
      el.textContent = content
    }

    this.messagesEl?.appendChild(el)
    this.scrollToBottom()
    return el
  }

  private removeSystemMessages(): void {
    this.messagesEl?.querySelectorAll('.aicb-message-system').forEach(el => el.remove())
  }

  private scrollToBottom(): void {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight
    }
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.inputEl) this.inputEl.disabled = !enabled
    const sendBtn = this.panel?.querySelector('.aicb-send') as HTMLButtonElement
    if (sendBtn) sendBtn.disabled = !enabled
  }

  private createElements(): void {
    const colors = this.options.glowColors.join(', ')
    const positionClass = `aicb-pos-${this.options.position}`

    this.container = document.createElement('div')
    this.container.className = `aicb-container ${positionClass}`
    if (this.options.theme !== 'auto') {
      this.container.setAttribute('data-theme', this.options.theme)
    }

    this.container.innerHTML = `
      <div class="aicb-fab">
        <div class="aicb-fab-glow" style="background: conic-gradient(from 0deg, ${colors}, ${this.options.glowColors[0]})"></div>
        <button class="aicb-fab-btn" title="Private AI - runs offline">
          <svg class="aicb-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2M7.5 13A1.5 1.5 0 006 14.5 1.5 1.5 0 007.5 16 1.5 1.5 0 009 14.5 1.5 1.5 0 007.5 13m9 0a1.5 1.5 0 00-1.5 1.5 1.5 1.5 0 001.5 1.5 1.5 1.5 0 001.5-1.5 1.5 1.5 0 00-1.5-1.5"/>
          </svg>
        </button>
      </div>
      <div class="aicb-panel aicb-hidden">
        <div class="aicb-header">
          <span>Private AI <span class="aicb-badge">offline</span> <code class="aicb-model">gemini-nano</code></span>
          <button class="aicb-close" title="Minimize">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
        </div>
        <div class="aicb-messages">
          <div class="aicb-message aicb-message-system">${this.options.welcomeMessage}</div>
        </div>
        <div class="aicb-input-container">
          <input type="text" class="aicb-input" placeholder="Ask anything..." />
          <button class="aicb-send" title="Send">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    `

    this.fab = this.container.querySelector('.aicb-fab')
    this.panel = this.container.querySelector('.aicb-panel')
    this.messagesEl = this.container.querySelector('.aicb-messages')
    this.inputEl = this.container.querySelector('.aicb-input')
  }

  private attachEventListeners(): void {
    this.fab?.querySelector('.aicb-fab-btn')?.addEventListener('click', () => this.open())
    this.panel?.querySelector('.aicb-close')?.addEventListener('click', () => this.close())
    this.panel?.querySelector('.aicb-send')?.addEventListener('click', () => this.sendMessage())

    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
      }
    })

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return
      const target = e.target as HTMLElement
      if (!this.panel?.contains(target) && !this.fab?.contains(target)) {
        this.close()
      }
    })
  }

  private injectStyles(): void {
    if (document.getElementById('aicb-styles')) return

    const style = document.createElement('style')
    style.id = 'aicb-styles'
    style.textContent = `
      .aicb-container {
        --aicb-bg: #1e1e1e;
        --aicb-header-bg: #252526;
        --aicb-border: #3c3c3c;
        --aicb-text: #d4d4d4;
        --aicb-text-muted: #808080;
        --aicb-accent: #007acc;
        --aicb-pane-bg: #2d2d2d;
      }

      .aicb-container[data-theme="light"] {
        --aicb-bg: #ffffff;
        --aicb-header-bg: #f3f3f3;
        --aicb-border: #d4d4d4;
        --aicb-text: #1e1e1e;
        --aicb-text-muted: #6e6e6e;
        --aicb-accent: #0066b8;
        --aicb-pane-bg: #e8e8e8;
      }

      @media (prefers-color-scheme: light) {
        .aicb-container:not([data-theme="dark"]) {
          --aicb-bg: #ffffff;
          --aicb-header-bg: #f3f3f3;
          --aicb-border: #d4d4d4;
          --aicb-text: #1e1e1e;
          --aicb-text-muted: #6e6e6e;
          --aicb-accent: #0066b8;
          --aicb-pane-bg: #e8e8e8;
        }
      }

      .aicb-fab {
        position: fixed;
        bottom: 24px;
        z-index: 10000;
      }

      .aicb-pos-center .aicb-fab { left: 50%; transform: translateX(-50%); }
      .aicb-pos-right .aicb-fab { right: 24px; }
      .aicb-pos-left .aicb-fab { left: 24px; }

      .aicb-fab.aicb-hidden { display: none; }

      .aicb-fab-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 64px;
        height: 64px;
        border-radius: 50%;
        animation: aicb-rotate 3s linear infinite;
        filter: blur(8px);
        opacity: 0.8;
      }

      @keyframes aicb-rotate {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }

      .aicb-fab-btn {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--aicb-header-bg);
        border: 2px solid var(--aicb-border);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
        z-index: 1;
      }

      .aicb-fab-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }

      .aicb-fab-btn.aicb-downloading {
        animation: aicb-pulse 1s ease-in-out infinite;
      }

      @keyframes aicb-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .aicb-fab-icon {
        width: 28px;
        height: 28px;
        stroke: var(--aicb-text);
      }

      .aicb-panel {
        position: fixed;
        bottom: 24px;
        width: 420px;
        max-height: 520px;
        background: var(--aicb-header-bg);
        border: 1px solid var(--aicb-border);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: scale(0);
        transform-origin: bottom center;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
      }

      .aicb-pos-center .aicb-panel { left: 50%; transform: translateX(-50%) scale(0); }
      .aicb-pos-center .aicb-panel.aicb-visible { transform: translateX(-50%) scale(1); }
      .aicb-pos-right .aicb-panel { right: 24px; transform-origin: bottom right; }
      .aicb-pos-left .aicb-panel { left: 24px; transform-origin: bottom left; }

      .aicb-panel.aicb-visible { opacity: 1; transform: scale(1); }
      .aicb-panel.aicb-hidden { opacity: 0; transform: scale(0); pointer-events: none; }
      .aicb-pos-center .aicb-panel.aicb-hidden { transform: translateX(-50%) scale(0); }

      .aicb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: var(--aicb-pane-bg);
        border-bottom: 1px solid var(--aicb-border);
        font-size: 13px;
        font-weight: 500;
        color: var(--aicb-text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .aicb-badge {
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 6px;
        margin-left: 6px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-radius: 4px;
      }

      .aicb-model {
        font-size: 10px;
        font-weight: 400;
        padding: 2px 6px;
        margin-left: 4px;
        background: var(--aicb-bg);
        color: var(--aicb-text-muted);
        border-radius: 4px;
        font-family: 'Consolas', 'Monaco', monospace;
      }

      .aicb-close {
        background: transparent;
        border: none;
        color: var(--aicb-text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .aicb-close:hover {
        background: var(--aicb-border);
        color: var(--aicb-text);
      }

      .aicb-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 200px;
        max-height: 350px;
        background: var(--aicb-bg);
      }

      .aicb-message {
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.5;
        max-width: 90%;
        word-wrap: break-word;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .aicb-message-system {
        background: var(--aicb-pane-bg);
        color: var(--aicb-text-muted);
        font-size: 12px;
        align-self: center;
        text-align: center;
        max-width: 100%;
      }

      .aicb-message-user {
        background: var(--aicb-accent);
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }

      .aicb-message-ai {
        background: var(--aicb-pane-bg);
        color: var(--aicb-text);
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }

      .aicb-message-ai p { margin: 0 0 8px 0; }
      .aicb-message-ai p:last-child { margin-bottom: 0; }
      .aicb-message-ai code {
        background: var(--aicb-bg);
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 12px;
      }
      .aicb-message-ai pre {
        background: var(--aicb-bg);
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 8px 0;
      }
      .aicb-message-ai pre code { background: none; padding: 0; }
      .aicb-message-ai ul, .aicb-message-ai ol { margin: 8px 0; padding-left: 20px; }
      .aicb-message-ai li { margin: 4px 0; }

      .aicb-input-container {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid var(--aicb-border);
        background: var(--aicb-pane-bg);
      }

      .aicb-input {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        background: var(--aicb-bg);
        color: var(--aicb-text);
        border: 1px solid var(--aicb-border);
        border-radius: 6px;
        outline: none;
      }

      .aicb-input:focus { border-color: var(--aicb-accent); }

      .aicb-send {
        padding: 8px 12px;
        background: var(--aicb-accent);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .aicb-send:hover { opacity: 0.9; }
      .aicb-send:disabled { opacity: 0.5; cursor: not-allowed; }
    `
    document.head.appendChild(style)
  }
}

export default AIChatbox
