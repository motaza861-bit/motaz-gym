import './Chat.css'

export default function ChatBubble({ role, type, content }) {
  if (type === 'typing') {
    return (
      <div className="chat-row left">
        <div className="chat-bubble assistant chat-typing">
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" />
        </div>
      </div>
    )
  }
  const side = role === 'user' ? 'right' : 'left'
  const cls = role === 'user' ? 'user' : 'assistant'
  return (
    <div className={`chat-row ${side}`}>
      <div className={`chat-bubble ${cls}`}>{content}</div>
    </div>
  )
}
