import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import SideRays from './components/SideRays'
import CurvedInput from './components/CurvedInput'
import Shuffle from './components/Shuffle'
import SlingButton from './components/SlingButton'
import './App.css'

const prompts = [
  ['✦', 'Explora una idea', 'Ayúdame a desarrollar una idea creativa'],
  ['◌', 'Aprende algo', 'Explícame un tema complejo de forma sencilla'],
  ['⌘', 'Escribe mejor', 'Ayúdame a escribir un correo profesional'],
  ['✳', 'Resuelve dudas', 'Ayúdame a organizar mis tareas de hoy'],
]

function Icon({ name, size = 20 }) {
  const paths = {
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v4h4M12 7v5l3 2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chat: <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.4A7.5 7.5 0 1 1 20 11.5Z" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    close: <path d="M5 5l14 14M19 5 5 19" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function savedChats() {
  try {
    const value = JSON.parse(localStorage.getItem('santi-ai-chats') || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function ErrorNotice({ issue, onClose }) {
  const labels = {
    kind: 'Tipo', httpStatus: 'HTTP', providerCode: 'Código de Gemini',
    providerStatus: 'Estado de Gemini', reason: 'Motivo', quotaMetric: 'Cuota afectada',
    retryAfter: 'Reintentar después de', networkCode: 'Código de red',
    blockReason: 'Bloqueo', finishReason: 'Finalización', model: 'Modelo',
    providerMessage: 'Mensaje de Gemini',
  }
  const rows = Object.entries(issue.diagnostic || {}).filter(([, value]) => value !== undefined && value !== '')
  return <div className="error-banner" role="alert">
    <button className="error-close" onClick={onClose} aria-label="Cerrar error">×</button>
    <strong>{issue.title}</strong>
    {issue.explanation && <p>{issue.explanation}</p>}
    <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer">Revisar límites y uso en Google AI Studio</a>
    {rows.length > 0 && <details><summary>Ver detalles técnicos</summary><dl>{rows.map(([key, value]) => <div key={key}><dt>{labels[key] || key}</dt><dd>{String(value)}</dd></div>)}</dl></details>}
  </div>
}

export default function App() {
  const [chats, setChats] = useState(savedChats)
  const [activeId, setActiveId] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [flight, setFlight] = useState(null)
  const [error, setError] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const conversationRef = useRef(null)
  const composerRef = useRef(null)
  const bottomRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const messages = chats.find(chat => chat.id === activeId)?.messages || []

  useEffect(() => { localStorage.setItem('santi-ai-chats', JSON.stringify(chats)) }, [chats])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }) }, [chats, activeId, busy, reducedMotion])

  function newChat() {
    setActiveId(null)
    setDraft('')
    setError(null)
    setHistoryOpen(false)
    document.querySelector('.curved-input__field')?.focus()
  }

  function deleteChat(id) {
    setChats(current => current.filter(chat => chat.id !== id))
    if (activeId === id) setActiveId(null)
  }

  async function requestAnswer(id, outgoing) {
    setBusy(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: outgoing.slice(-30) }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError({
          title: data.error || 'Gemini no pudo responder.',
          explanation: data.explanation || 'Consulta los detalles técnicos para identificar la causa.',
          diagnostic: { httpStatus: response.status, ...data.diagnostic },
        })
        return
      }
      setChats(current => current.map(chat => chat.id === id
        ? { ...chat, messages: [...outgoing, { role: 'model', text: data.answer }] }
        : chat))
    } catch (cause) {
      setError({
        title: cause instanceof SyntaxError ? 'La respuesta del servidor no es JSON.' : 'No se pudo conectar con el servidor local.',
        explanation: 'Comprueba que la aplicación esté ejecutándose y revisa la consola del servidor.',
        diagnostic: { kind: 'LOCAL_SERVER_ERROR' },
      })
    } finally {
      setBusy(false)
    }
  }

  function landMessage(payload) {
    const { id, text, outgoing } = payload
    setChats(current => current.some(chat => chat.id === id)
      ? current.map(chat => chat.id === id ? { ...chat, messages: outgoing } : chat)
      : [{ id, title: text.slice(0, 36), messages: outgoing }, ...current])
    setActiveId(id)
    setFlight(null)
    void requestAnswer(id, outgoing)
  }

  function launch(text = draft, sourceElement) {
    const value = text.trim()
    if (!value || busy || flight) return
    const id = activeId || crypto.randomUUID()
    const outgoing = [...messages, { role: 'user', text: value }]
    setDraft('')
    setError(null)
    setHistoryOpen(false)

    if (reducedMotion) {
      landMessage({ id, text: value, outgoing })
      return
    }

    const source = (sourceElement || composerRef.current)?.getBoundingClientRect()
    const area = conversationRef.current?.getBoundingClientRect()
    if (!source || !area) {
      landMessage({ id, text: value, outgoing })
      return
    }
    const measure = document.createElement('canvas').getContext('2d')
    if (measure) measure.font = "15px 'DM Sans', sans-serif"
    const lineWidth = measure?.measureText(value.split('\n')[0]).width || value.length * 8
    const bubbleWidth = Math.min(390, area.width - 48, Math.max(90, Math.ceil(lineWidth) + 34))
    const targetY = messages.length && bottomRef.current
      ? Math.min(area.bottom - 90, Math.max(area.top + 70, bottomRef.current.getBoundingClientRect().top + 26))
      : area.top + 114
    setFlight({
      id, text: value, outgoing,
      startX: source.left + 22,
      startY: source.top + source.height / 2 - 15,
      endX: area.right - bubbleWidth - 28,
      endY: targetY,
      width: bubbleWidth,
    })
  }

  return <div className="app-shell">
    <div className="rays-layer"><SideRays rayColor1="#F5744D" rayColor2="#182F53" origin="top-right" speed={1.2} intensity={1.1} spread={2.2} density={5} lightMode opacity={0.28} followMouse={false} /></div>

    <button className="history-trigger" aria-label="Ver historial de chats" title="Ver historial" onClick={() => setHistoryOpen(true)}><Icon name="history" size={23} /></button>

    <main className="main-panel">
      <section ref={conversationRef} className={`conversation ${messages.length ? 'started' : ''} ${flight && !messages.length ? 'leaving-welcome' : ''}`} aria-label="Chat">
        {!messages.length ? <div className="welcome">
          <div className="welcome-emblem" aria-hidden="true">✳</div>
          <p className="eyebrow">TU ESPACIO PARA PENSAR EN GRANDE</p>
          <h1>Hola, soy <Shuffle tag="span" text="SANTI.AI" className="title-shuffle" effect="slide" shuffleTimes={1} stagger={0.035} duration={0.42} triggerOnHover respectReducedMotion /></h1>
          <p className="welcome-copy">Una buena conversación puede llevarte a cualquier lugar.<br />¿Qué tienes en mente hoy?</p>
          <div className="suggestions">{prompts.map(([symbol, title, text]) => <button className="suggestion" key={title} onClick={event => launch(text, event.currentTarget)} disabled={busy || !!flight}><span className="suggestion-icon">{symbol}</span><strong>{title}</strong><small>{text}</small></button>)}</div>
        </div> : <div className="message-stack">
          {messages.map((message, index) => <article className={`message message-${message.role}`} key={`${activeId}-${index}`}>
            <div className="message-avatar" aria-hidden="true">{message.role === 'model' ? '✳' : 'T'}</div>
            <div className="message-body"><strong>{message.role === 'model' ? 'SANTI.AI' : 'Tú'}</strong><div>{message.text}</div></div>
          </article>)}
          {busy && <div className="typing" aria-label="SANTI.AI está escribiendo"><span /><span /><span /></div>}
          <div ref={bottomRef} />
        </div>}
      </section>

      <div className="composer-area" ref={composerRef}>
        {error && <ErrorNotice issue={error} onClose={() => setError(null)} />}
        <div className="input-wrap">
          <CurvedInput className="chat-curved-input" value={draft} onChange={setDraft} onSubmit={launch} placeholder="Escribe tu mensaje aquí..." type="text" ariaLabel="Escribe tu mensaje" maxLength={6000} width="100%" bend={16} height={64} fontSize={15} showIcon={false} showButton={false} endInset={108} shadowSize="sm" backgroundColor="#FFFCF8" textColor="#182F53" placeholderColor="#8D9AAB" borderColor="#E5C7BA" buttonColor="#F5744D" shadowColor="#182F53" />
          <div className="sling-wrap"><SlingButton onSend={() => launch()} disabled={busy || !!flight || !draft.trim()} padColor="#F5744D" iconColor="#F9EEE2" accentColor="#F5744D" wellColor="#F9EEE2" bandColor="#182F53" size={52} flight={105} particles={10} ariaLabel="Enviar mensaje" /></div>
        </div>
      </div>
    </main>

    {flight && <motion.div key={flight.id} className="flying-message" style={{ width: flight.width }} initial={{ x: flight.startX, y: flight.startY, opacity: 0.7, scale: 0.92 }} animate={{ x: flight.endX, y: flight.endY, opacity: 1, scale: 1 }} transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }} onAnimationComplete={() => landMessage(flight)}>{flight.text}</motion.div>}

    {historyOpen && <><button className="history-scrim" aria-label="Cerrar historial" onClick={() => setHistoryOpen(false)} /><aside className="history-panel" aria-label="Historial de chats"><div className="history-heading"><div><span>CONVERSACIONES</span><h2>Tu historial</h2></div><button className="panel-icon" aria-label="Cerrar historial" onClick={() => setHistoryOpen(false)}><Icon name="close" /></button></div><button className="new-chat" onClick={newChat}><Icon name="plus" />Nueva conversación</button><nav className="chat-list" aria-label="Conversaciones anteriores">{!chats.length && <p className="empty-history">Aquí aparecerán tus conversaciones.</p>}{chats.map(chat => <div className={`chat-row ${activeId === chat.id ? 'active' : ''}`} key={chat.id}><button className="chat-select" onClick={() => { setActiveId(chat.id); setError(null); setHistoryOpen(false) }}><Icon name="chat" size={18} /><span>{chat.title}</span></button><button className="delete-chat" aria-label={`Eliminar ${chat.title}`} onClick={() => deleteChat(chat.id)}><Icon name="trash" size={17} /></button></div>)}</nav></aside></>}
  </div>
}
