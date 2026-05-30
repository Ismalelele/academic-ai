import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, FileText, UploadCloud, MessageSquare, BookOpen, Bot, Trash2, X, MoreVertical, Edit2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useSchedule } from '../context/ScheduleContext';
import { marked } from 'marked';

export default function Asistente() {
  const { schedule } = useSchedule();
  const { subjectData, getSubjectData, uploadDocument, sendMessage, deleteDocument, clearDocuments, toggleDocumentSelection, renameDocument } = useChat();
  const [activeSubject, setActiveSubject] = useState('global');
  const [inputText, setInputText] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Extract unique subjects from the schedule
  const uniqueSubjects = schedule ? Array.from(new Set(schedule.map(c => c.title))) : [];

  const currentData = getSubjectData(activeSubject);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(activeSubject, inputText);
    setInputText('');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      files.forEach(file => uploadDocument(activeSubject, file));
      e.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentData.messages]);

  return (
    <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={32} color="var(--primary)" /> Asistente de IA
          </h1>
          <p className="subtitle">Pregunta a la IA sobre tus apuntes de estudio, resúmenes y documentos</p>
        </div>
      </header>

      <div className="chat-layout" style={{ flex: 1, minHeight: 0, height: 'auto' }}>
        {/* Sidebar Repositorio */}
        <aside className="chat-sidebar">
        <div className="sidebar-header">
          <BookOpen size={24} color="var(--primary)" />
          <h2>Repositorio</h2>
        </div>

        <div className="subject-selector">
          <label>Asignatura / Contexto</label>
          <select 
            value={activeSubject} 
            onChange={(e) => setActiveSubject(e.target.value)}
          >
            <option value="global">Global (Todos los apuntes)</option>
            {uniqueSubjects.map((sub, idx) => (
              <option key={idx} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        <div className="documents-list">
          <div className="documents-list-header">
            <h3>Documentos Subidos</h3>
          </div>
          {currentData.documents.length === 0 ? (
            <div className="empty-docs">
              <FileText size={32} />
              <p>No hay documentos en este ramo.</p>
            </div>
          ) : (
            <ul>
              {currentData.documents.map(doc => (
                <li key={doc.id} className="doc-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexGrow: 1 }}>
                    <FileText size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                    <span className="doc-name" style={{ opacity: doc.selected === false ? 0.5 : 1 }}>{doc.name}</span>
                    {doc.isParsing && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontStyle: 'italic', flexShrink: 0, animation: 'pulse 1.5s infinite' }}>Leyendo...</span>}
                    {doc.error && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }} title={typeof doc.error === 'string' ? doc.error : 'Error'}>Error: {typeof doc.error === 'string' ? doc.error : 'Fallo subida'}</span>}
                  </div>
                  
                  <div className="doc-actions" onClick={e => e.stopPropagation()}>
                    <div className="doc-menu-container" style={{ position: 'relative' }}>
                      <button className="btn-icon" onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}>
                        <MoreVertical size={16} />
                      </button>
                      
                      {openMenuId === doc.id && (
                        <div className="doc-dropdown-menu">
                          <button onClick={() => {
                            setOpenMenuId(null);
                            const newName = window.prompt("Cambiar nombre de archivo:", doc.name);
                            if (newName && newName.trim()) renameDocument(activeSubject, doc.id, newName.trim());
                          }}>
                            <Edit2 size={14} /> Cambiar nombre de archivo
                          </button>
                          <button onClick={() => {
                            setOpenMenuId(null);
                            deleteDocument(activeSubject, doc.id);
                          }} className="text-danger">
                            <Trash2 size={14} /> Eliminar archivo
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <input 
                      type="checkbox" 
                      className="doc-checkbox"
                      checked={doc.selected !== false} 
                      onChange={() => toggleDocumentSelection(activeSubject, doc.id)} 
                      title="Incluir en la búsqueda de la IA"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="upload-box">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
            style={{ display: 'none' }} 
            accept=".pdf,.doc,.docx,.txt"
            multiple
          />
          <button className="btn-upload" onClick={() => fileInputRef.current.click()}>
            <UploadCloud size={20} />
            Subir Apunte (PDF/Word)
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="chat-area">
        <header className="chat-header">
          <div className="ai-info">
            <div className="ai-avatar"><Bot size={24} /></div>
            <div>
              <h2>Asistente de Estudio</h2>
              <p>Consultando: <strong>{activeSubject === 'global' ? 'Repositorio Global' : activeSubject}</strong></p>
            </div>
          </div>
        </header>

        <div className="messages-container">
          {currentData.messages.map(msg => (
            <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
              <div className="message-bubble">
                {msg.sender === 'ai' ? (
                  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text || '') }} />
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <form onSubmit={handleSend} className="chat-form">
            <button type="button" className="btn-attach" onClick={() => fileInputRef.current.click()}>
              <Paperclip size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Hazme una pregunta sobre tus apuntes..." 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" className="btn-send" disabled={!inputText.trim()}>
              <Send size={20} />
            </button>
          </form>
        </div>
      </section>
      </div>
    </main>
  );
}
