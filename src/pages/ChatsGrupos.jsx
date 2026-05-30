import { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, Plus, Users, Send, Copy, Check, X, Bell, BellOff, 
  BookOpen, HelpCircle, ShieldAlert, Sparkles, Hash, ArrowRight,
  Star, ChevronLeft, ChevronRight, Brain, PencilLine, Trash2
} from 'lucide-react';
import { useGroupChat } from '../context/GroupChatContext';
import { useAuth } from '../context/AuthContext';
import { marked } from 'marked';

export default function ChatsGrupos() {
  const { user } = useAuth();
  const {
    groups,
    activeGroupId,
    setActiveGroupId,
    messages,
    pendingRequests,
    activeGroupMembers,
    isFallbackMode,
    loading,
    createGroup,
    joinGroup,
    sendGroupMessage,
    toggleGroupNotifications,
    approveMemberRequest,
    rejectMemberRequest,
    simulateRequest,
    simulateIncomingMessage,
    fetchLibraryItems,
    shareItemInLibrary,
    rateLibraryItem
  } = useGroupChat();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' o 'solicitudes'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [chatInputText, setChatInputText] = useState('');

  // UI States
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Library States
  const [groupSubTab, setGroupSubTab] = useState('chat'); // 'chat' | 'library'
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Sharing Modal States
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareContentType, setShareContentType] = useState('apunte_link'); // 'apunte_link' | 'summary' | 'flashcards'
  const [shareSelectedNoteId, setShareSelectedNoteId] = useState('');
  const [shareManualContent, setShareManualContent] = useState('');
  const [shareFlashcards, setShareFlashcards] = useState([{ front: '', back: '' }]);
  const [userNotes, setUserNotes] = useState([]);

  // Viewing Modal States
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const messagesEndRef = useRef(null);

  const activeGroup = groups.find(g => g.id_grupo === activeGroupId);

  // Reset subtab on group change
  useEffect(() => {
    setGroupSubTab('chat');
  }, [activeGroupId]);

  // Load library when tab changes or active group changes
  const loadLibrary = async () => {
    if (!activeGroupId) return;
    setLibraryLoading(true);
    try {
      const items = await fetchLibraryItems(activeGroupId);
      // Order by average rating (descending), then date (descending)
      const sorted = [...items].sort((a, b) => {
        if (b.avg_rating !== a.avg_rating) {
          return b.avg_rating - a.avg_rating;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setLibraryItems(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    if (activeGroupId && groupSubTab === 'library') {
      loadLibrary();
    }
  }, [activeGroupId, groupSubTab]);

  const loadUserNotes = () => {
    if (!user || !activeGroup) return;
    const saved = localStorage.getItem(`academic_notes_${user.id}_${activeGroup.asignatura}`);
    if (saved) {
      setUserNotes(JSON.parse(saved));
    } else {
      setUserNotes([]);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareTitle.trim() || !activeGroupId) return;

    let contentData = '';
    if (shareContentType === 'apunte_link') {
      if (shareSelectedNoteId) {
        const selectedNote = userNotes.find(n => n.id === shareSelectedNoteId);
        contentData = selectedNote ? selectedNote.content : '';
      } else {
        contentData = shareManualContent;
      }
    } else if (shareContentType === 'summary') {
      contentData = shareManualContent;
    } else if (shareContentType === 'flashcards') {
      contentData = JSON.stringify(shareFlashcards);
    }

    try {
      await shareItemInLibrary(activeGroupId, {
        title: shareTitle.trim(),
        description: shareDescription.trim(),
        content_type: shareContentType,
        content_data: contentData
      });

      setShareTitle('');
      setShareDescription('');
      setShareContentType('apunte_link');
      setShareSelectedNoteId('');
      setShareManualContent('');
      setShareFlashcards([{ front: '', back: '' }]);
      setShowShareModal(false);
      
      loadLibrary();
    } catch (err) {
      alert("Error al compartir recurso: " + err.message);
    }
  };

  const handleViewResource = (item) => {
    setViewingItem(item);
    setCurrentCardIdx(0);
    setIsFlipped(false);
    setShowViewModal(true);
  };

  // Auto-scroll al fondo al recibir mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupTitle.trim() || !newGroupSubject.trim()) return;

    await createGroup(newGroupTitle.trim(), newGroupSubject.trim());
    setNewGroupTitle('');
    setNewGroupSubject('');
    setShowCreateModal(false);
  };

  const handleJoinGroupSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!joinCodeInput.trim()) return;

    try {
      const joined = await joinGroup(joinCodeInput.trim());
      setJoinCodeInput('');
      setShowJoinModal(false);
      alert(`Solicitud enviada con éxito para unirse a "${joined.titulo}". El creador deberá aceptarte.`);
    } catch (err) {
      setErrorMessage(err.message || 'Ocurrió un error.');
    }
  };

  const handleSendMessageSubmit = (e) => {
    e.preventDefault();
    if (!chatInputText.trim() || !activeGroupId) return;

    sendGroupMessage(activeGroupId, chatInputText.trim());
    setChatInputText('');
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatMessageTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="main-content">
      <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={32} color="var(--primary)" /> Chats de Asignaturas
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Crea salas de estudio para tus asignaturas, comparte códigos de invitación y debate con tus compañeros.
          </p>
        </div>
        {isFallbackMode && (
          <span style={{ 
            fontSize: '0.8rem', 
            background: 'rgba(245, 158, 11, 0.15)', 
            color: '#b45309', 
            padding: '6px 12px', 
            borderRadius: '20px', 
            fontWeight: 'bold',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={14} /> Modo Demostración Local
          </span>
        )}
      </header>

      <div className="chats-view-layout">
        {/* PANEL LATERAL DE GRUPOS Y SOLICITUDES */}
        <aside className="chats-sidebar">
          <div className="chats-sidebar-header">
            <h2>Mi Comunidad</h2>
            <div className="chats-sidebar-actions">
              <button className="btn-chat-action primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> Crear
              </button>
              <button className="btn-chat-action" onClick={() => setShowJoinModal(true)}>
                <ArrowRight size={16} /> Unirse
              </button>
            </div>
          </div>

          <div className="chats-tabs">
            <button 
              className={`chats-tab ${activeTab === 'chats' ? 'active' : ''}`}
              onClick={() => setActiveTab('chats')}
            >
              Mis Grupos ({groups.length})
            </button>
            <button 
              className={`chats-tab ${activeTab === 'solicitudes' ? 'active' : ''}`}
              onClick={() => setActiveTab('solicitudes')}
            >
              Solicitudes 
              {pendingRequests.length > 0 && (
                <span className="chats-group-badge">{pendingRequests.length}</span>
              )}
            </button>
          </div>

          {activeTab === 'chats' ? (
            <div className="chats-sidebar-list">
              {groups.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No estás en ningún grupo. ¡Crea uno nuevo o únete con un código de invitación!
                </div>
              ) : (
                groups.map(group => {
                  const isActive = group.id_grupo === activeGroupId;
                  const isAccepted = group.membership?.estado === 'aceptado';
                  const notifEnabled = group.membership?.notificaciones_activas !== false;
                  
                  return (
                    <div 
                      key={group.id_grupo} 
                      className={`chats-group-item ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveGroupId(group.id_grupo)}
                      style={{ opacity: isAccepted ? 1 : 0.6 }}
                    >
                      <div className="chats-group-info">
                        <div className="chats-group-title">{group.titulo}</div>
                        <div className="chats-group-sub">
                          {group.asignatura} • {isAccepted ? 'Miembro' : 'Pendiente'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isAccepted ? (
                          notifEnabled ? (
                            <Bell size={14} color="var(--primary)" title="Alertas activas" />
                          ) : (
                            <BellOff size={14} color="var(--text-muted)" title="Alertas silenciadas" />
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="chats-sidebar-list" style={{ padding: '15px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '10px' }}>
                SOLICITUDES RECIBIDAS
              </div>
              {pendingRequests.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No tienes solicitudes de ingreso pendientes.
                </div>
              ) : (
                pendingRequests.map(req => (
                  <div key={req.id_miembro} className="chats-request-item">
                    <div className="chats-request-header">
                      <div className="chats-request-user">
                        <span className="chats-request-name">{req.user_name}</span>
                        <span className="chats-request-email">{req.user_email}</span>
                      </div>
                      <span className="chats-request-tag">{req.grupo_titulo}</span>
                    </div>
                    <div className="chats-request-actions">
                      <button 
                        className="btn-request-action approve"
                        onClick={() => approveMemberRequest(req.id_miembro)}
                      >
                        Aceptar
                      </button>
                      <button 
                        className="btn-request-action reject"
                        onClick={() => rejectMemberRequest(req.id_miembro)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SIMULADOR DE DEMO */}
          {isFallbackMode && activeGroupId && activeGroup?.membership?.estado === 'aceptado' && (
            <div className="chats-simulator-box">
              <div className="chats-simulator-title">Simulador de Acciones</div>
              <div className="chats-simulator-btns">
                <button 
                  className="btn-simulator" 
                  onClick={() => simulateRequest(activeGroupId)}
                >
                  <Users size={12} /> Simular Solicitud Unión
                </button>
                <button 
                  className="btn-simulator" 
                  onClick={() => simulateIncomingMessage(activeGroupId)}
                >
                  <MessageSquare size={12} /> Simular Mensaje Inmediato
                </button>
                <button 
                  className="btn-simulator" 
                  onClick={() => {
                    simulateIncomingMessage(activeGroupId, '', 5);
                    alert("Mensaje programado en 5 segundos. ¡Sal del chat o ve al Dashboard para ver la notificación!");
                  }}
                  style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.3)' }}
                >
                  <Bell size={12} /> Simular Mensaje en 5 seg
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* VENTANA DE CHAT ACTIVO */}
        <section className="chats-main-window">
          {activeGroup ? (
            activeGroup.membership?.estado === 'aceptado' ? (
              <>
                {/* Header del Chat */}
                <header className="chats-header">
                  <div className="chats-header-info">
                    <h3>{activeGroup.titulo}</h3>
                    <p>Asignatura: <strong>{activeGroup.asignatura}</strong></p>
                  </div>
                  <div className="chats-header-actions">
                    <div className="chats-invite-code-container">
                      <span className="chats-invite-code-label">CÓDIGO:</span>
                      <span className="chats-invite-code-val">{activeGroup.codigo_invitacion}</span>
                      <button 
                        className="chats-copy-btn" 
                        onClick={() => copyToClipboard(activeGroup.codigo_invitacion)}
                        title="Copiar código de invitación"
                      >
                        {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div className="chats-notif-toggle-container">
                      <span>Notificaciones</span>
                      <label className="custom-switch">
                        <input 
                          type="checkbox"
                          checked={activeGroup.membership?.notificaciones_activas !== false}
                          onChange={(e) => toggleGroupNotifications(activeGroup.id_grupo, e.target.checked)}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  </div>
                </header>

                {/* Sub Tab Selector (Mensajes / Biblioteca) */}
                <div className="group-tab-selector" style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'rgba(0, 0, 0, 0.08)',
                  padding: '0 20px',
                  gap: '5px'
                }}>
                  <button 
                    onClick={() => setGroupSubTab('chat')}
                    style={{
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      color: groupSubTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: groupSubTab === 'chat' ? '3px solid var(--primary)' : '3px solid transparent',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: '0.2s'
                    }}
                  >
                    <MessageSquare size={15} /> Mensajes
                  </button>
                  <button 
                    onClick={() => setGroupSubTab('library')}
                    style={{
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      color: groupSubTab === 'library' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: groupSubTab === 'library' ? '3px solid var(--primary)' : '3px solid transparent',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: '0.2s'
                    }}
                  >
                    <BookOpen size={15} /> Biblioteca
                  </button>
                </div>

                {groupSubTab === 'chat' ? (
                  <>
                    {/* Historial de Mensajes */}
                    <div className="chats-messages-area">
                      {messages.length === 0 ? (
                        <div className="chats-message-system">
                          Inicio del grupo "{activeGroup.titulo}". ¡Comparte el código de invitación para que otros se unan!
                        </div>
                      ) : (
                        messages.map((msg, i) => {
                          const isMe = msg.user_id === user?.id;
                          const isSystem = !msg.user_id;

                          if (isSystem) {
                            return (
                              <div key={msg.id_mensaje || i} className="chats-message-system">
                                {msg.texto}
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={msg.id_mensaje || i} 
                              className={`chats-message-wrapper ${isMe ? 'outgoing' : 'incoming'}`}
                            >
                              {!isMe && <span className="chats-message-sender">{msg.user_name}</span>}
                              <div className="chats-message-bubble">
                                {msg.texto}
                              </div>
                              <span className="chats-message-meta">
                                {formatMessageTime(msg.fecha_envio)}
                              </span>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Entrada de Mensaje */}
                    <form onSubmit={handleSendMessageSubmit} className="chats-input-form">
                      <input 
                        type="text" 
                        placeholder={`Escribe un mensaje en ${activeGroup.titulo}...`}
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                      />
                      <button 
                        type="submit" 
                        className="chats-send-btn"
                        disabled={!chatInputText.trim()}
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  </>
                ) : (
                  /* Vista de Biblioteca */
                  <div className="chats-library-area" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.05)'
                  }}>
                    {/* Barra de Acciones de Biblioteca */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      background: 'rgba(255, 255, 255, 0.01)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={16} color="var(--primary)" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          Biblioteca del Grupo
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          loadUserNotes();
                          setShowShareModal(true);
                        }}
                        style={{
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: '600',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: '0.2s'
                        }}
                      >
                        <Plus size={14} /> Compartir Recurso
                      </button>
                    </div>

                    {/* Listado de recursos */}
                    {libraryLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '10px' }}>
                        <Loader size={32} className="lucide-spin" color="var(--primary)" />
                        <span style={{ fontSize: '0.85rem' }}>Cargando recursos...</span>
                      </div>
                    ) : libraryItems.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', gap: '12px' }}>
                        <BookOpen size={48} style={{ opacity: 0.3, color: 'var(--primary)' }} />
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem' }}>Biblioteca Vacía</h4>
                          <p style={{ fontSize: '0.8rem', marginTop: '6px', maxWidth: '280px', margin: '6px auto 0 auto', lineHeight: '1.4' }}>
                            ¡Sé el primero en compartir apuntes, fichas o resúmenes con tus compañeros de curso!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '15px',
                        padding: '15px',
                        overflowY: 'auto',
                        alignContent: 'start',
                        flex: 1
                      }}>
                        {libraryItems.map((item) => {
                          let IconComponent = BookOpen;
                          let typeLabel = 'Recurso';
                          let badgeBg = 'rgba(255, 255, 255, 0.05)';
                          let badgeColor = 'var(--text-muted)';

                          if (item.content_type === 'summary') {
                            IconComponent = Sparkles;
                            typeLabel = 'Resumen';
                            badgeBg = 'rgba(167, 139, 250, 0.1)';
                            badgeColor = '#c084fc';
                          } else if (item.content_type === 'flashcards') {
                            IconComponent = Brain;
                            typeLabel = 'Fichas';
                            badgeBg = 'rgba(14, 165, 233, 0.1)';
                            badgeColor = 'var(--primary)';
                          } else if (item.content_type === 'apunte_link') {
                            IconComponent = PencilLine;
                            typeLabel = 'Apunte';
                            badgeBg = 'rgba(34, 197, 94, 0.1)';
                            badgeColor = '#4ade80';
                          }

                          return (
                            <div
                              key={item.id}
                              style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '14px',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s',
                                boxShadow: 'var(--shadow-sm)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: badgeBg,
                                    color: badgeColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <IconComponent size={18} />
                                  </div>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    padding: '3px 7px',
                                    borderRadius: '20px',
                                    background: badgeBg,
                                    color: badgeColor
                                  }}>
                                    {typeLabel}
                                  </span>
                                </div>

                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                                  {item.title}
                                </h4>
                                <p style={{
                                  margin: '0 0 12px 0',
                                  fontSize: '0.78rem',
                                  color: 'var(--text-muted)',
                                  lineHeight: '1.4',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}>
                                  {item.description}
                                </p>
                              </div>

                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                  {/* Avatar circle */}
                                  <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    {item.user_name ? item.user_name.charAt(0).toUpperCase() : 'C'}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-main)', fontWeight: '600' }}>
                                      {item.user_name || 'Compañero'}
                                    </span>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                      {new Date(item.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {/* Interactive rating stars */}
                                  <StarRating 
                                    avgRating={item.avg_rating || 0}
                                    userRating={item.user_rating || 0}
                                    onRate={async (rating) => {
                                      await rateLibraryItem(item.id, rating);
                                      loadLibrary();
                                    }}
                                  />
                                  
                                  <button
                                    onClick={() => handleViewResource(item)}
                                    style={{
                                      background: 'rgba(255,255,255,0.03)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-main)',
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: '0.2s'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = 'var(--primary)';
                                      e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                      e.currentTarget.style.color = 'var(--text-main)';
                                    }}
                                  >
                                    Ver Recurso
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Pantalla de Espera Aprobación */
              <div className="chats-welcome-screen">
                <ShieldAlert size={64} color="var(--primary)" style={{ opacity: 0.8 }} />
                <h3>Solicitud en Espera</h3>
                <p style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                  Has enviado una solicitud para unirte a <strong>{activeGroup.titulo}</strong>.<br/>
                  El creador del grupo debe aprobar tu ingreso antes de que puedas leer o enviar mensajes.
                </p>
                <div style={{
                  fontSize: '0.8rem', 
                  background: 'var(--bg)', 
                  padding: '10px 15px', 
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)'
                }}>
                  Código: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{activeGroup.codigo_invitacion}</strong>
                </div>
              </div>
            )
          ) : (
            /* Pantalla de Bienvenida */
            <div className="chats-welcome-screen">
              <BookOpen size={64} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '10px' }} />
              <h3>Tus Salas de Estudio</h3>
              <p style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                Selecciona un grupo del panel lateral para ingresar al chat o aprueba las solicitudes entrantes de tus grupos creados.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* MODAL CREAR GRUPO */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="premium-modal">
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              Crear Nuevo Grupo de Chat
            </h3>
            <form onSubmit={handleCreateGroupSubmit}>
              <div className="form-group-premium">
                <label>Nombre del Grupo o Tema</label>
                <input 
                  type="text" 
                  className="premium-input"
                  style={{ paddingLeft: '15px' }}
                  placeholder="Ej: Grupo de Estudio Solemne 2"
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-premium">
                <label>Asignatura</label>
                <input 
                  type="text" 
                  className="premium-input"
                  style={{ paddingLeft: '15px' }}
                  placeholder="Ej: Cálculo I"
                  value={newGroupSubject}
                  onChange={(e) => setNewGroupSubject(e.target.value)}
                  required
                />
              </div>

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit-premium">
                  Crear Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UNIRSE A GRUPO */}
      {showJoinModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="premium-modal">
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              Unirse a Grupo de Chat
            </h3>
            <form onSubmit={handleJoinGroupSubmit}>
              <div className="form-group-premium">
                <label>Código de Invitación</label>
                <input 
                  type="text" 
                  className="premium-input"
                  style={{ paddingLeft: '15px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '1px' }}
                  placeholder="Ej: MAT4219"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  required
                />
              </div>

              {errorMessage && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '10px' }}>
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => { setShowJoinModal(false); setErrorMessage(''); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit-premium">
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER RECURSO */}
      {showViewModal && viewingItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowViewModal(false)}>
          <div className="premium-modal" style={{ maxWidth: '650px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(14, 165, 233, 0.1)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {viewingItem.content_type === 'summary' ? <Sparkles size={20} /> : viewingItem.content_type === 'flashcards' ? <Brain size={20} /> : <BookOpen size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>{viewingItem.title}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Subido por {viewingItem.user_name || 'Compañero'}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px', marginBottom: '15px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px 0', fontStyle: 'italic', borderLeft: '3px solid var(--border-color)', paddingLeft: '10px' }}>
                {viewingItem.description}
              </p>

              {viewingItem.content_type === 'flashcards' ? (
                /* Interactive Flashcards View */
                <div>
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    style={{
                      height: '220px',
                      background: isFlipped ? 'rgba(14, 165, 233, 0.05)' : 'rgba(255,255,255,0.01)',
                      border: '1.5px dashed var(--primary)',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: '24px',
                      textAlign: 'center',
                      transition: 'all 0.3s ease',
                      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '15px', fontWeight: 'bold', letterSpacing: '1px' }}>
                        {isFlipped ? 'REVERSO (RESPUESTA)' : 'FRENTE (PREGUNTA)'}
                      </span>
                      <p style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.5' }}>
                        {isFlipped 
                          ? (JSON.parse(viewingItem.content_data || '[]')[currentCardIdx]?.back) 
                          : (JSON.parse(viewingItem.content_data || '[]')[currentCardIdx]?.front)
                        }
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'block', marginTop: '20px', fontWeight: 'bold' }}>
                        Haz clic para voltear
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                    <button 
                      disabled={currentCardIdx === 0} 
                      onClick={() => { setCurrentCardIdx(prev => prev - 1); setIsFlipped(false); }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        borderRadius: '8px',
                        cursor: currentCardIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: currentCardIdx === 0 ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                      }}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Ficha {currentCardIdx + 1} de {JSON.parse(viewingItem.content_data || '[]').length}
                    </span>
                    <button 
                      disabled={currentCardIdx === JSON.parse(viewingItem.content_data || '[]').length - 1} 
                      onClick={() => { setCurrentCardIdx(prev => prev + 1); setIsFlipped(false); }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        borderRadius: '8px',
                        cursor: currentCardIdx === JSON.parse(viewingItem.content_data || '[]').length - 1 ? 'not-allowed' : 'pointer',
                        opacity: currentCardIdx === JSON.parse(viewingItem.content_data || '[]').length - 1 ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                      }}
                    >
                      Siguiente <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Text summary/notes Markdown View */
                <div 
                  className="markdown-body"
                  style={{
                    background: 'rgba(0,0,0,0.15)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    color: 'var(--text-main)',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(viewingItem.content_data || '') }}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowViewModal(false)} 
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPARTIR RECURSO */}
      {showShareModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="premium-modal" style={{ maxWidth: '550px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              Compartir Recurso en la Biblioteca
            </h3>
            <form onSubmit={handleShareSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px', marginBottom: '15px' }}>
                <div className="form-group-premium">
                  <label>Título del Recurso</label>
                  <input 
                    type="text" 
                    className="premium-input"
                    style={{ paddingLeft: '15px' }}
                    placeholder="Ej: Resumen Cálculo 1 - Derivadas"
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group-premium">
                  <label>Descripción Breve</label>
                  <textarea 
                    className="premium-input"
                    style={{ padding: '10px 15px', minHeight: '60px', resize: 'vertical' }}
                    placeholder="Describe de qué trata este recurso..."
                    value={shareDescription}
                    onChange={(e) => setShareDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group-premium">
                  <label>Tipo de Recurso</label>
                  <select
                    className="premium-input"
                    style={{ paddingLeft: '15px', background: 'var(--bg)', color: 'var(--text-main)' }}
                    value={shareContentType}
                    onChange={(e) => setShareContentType(e.target.value)}
                  >
                    <option value="apunte_link">Apunte Personal</option>
                    <option value="summary">Resumen de Lectura</option>
                    <option value="flashcards">Fichas de Estudio (Flashcards)</option>
                  </select>
                </div>

                {shareContentType === 'apunte_link' && (
                  <div className="form-group-premium" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '15px' }}>
                    <label>Selecciona tu Apunte Guardado</label>
                    {userNotes.length > 0 ? (
                      <select
                        className="premium-input"
                        style={{ paddingLeft: '15px', background: 'var(--bg)', color: 'var(--text-main)', marginBottom: '15px' }}
                        value={shareSelectedNoteId}
                        onChange={(e) => setShareSelectedNoteId(e.target.value)}
                      >
                        <option value="">-- Selecciona uno de tus apuntes --</option>
                        {userNotes.map(note => (
                          <option key={note.id} value={note.id}>{note.title}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '5px 0 15px 0' }}>
                        ⚠️ No tienes apuntes guardados en la sección Apuntes para la asignatura "{activeGroup.asignatura}". 
                        Puedes redactar el contenido manualmente abajo.
                      </div>
                    )}
                    
                    <label>Contenido del Apunte (Markdown habilitado)</label>
                    <textarea 
                      className="premium-input"
                      style={{ padding: '10px 15px', minHeight: '120px', resize: 'vertical' }}
                      placeholder="Redacta el contenido del apunte..."
                      value={shareManualContent}
                      onChange={(e) => setShareManualContent(e.target.value)}
                      required={!shareSelectedNoteId}
                    />
                  </div>
                )}

                {shareContentType === 'summary' && (
                  <div className="form-group-premium" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '15px' }}>
                    <label>Contenido del Resumen (Markdown habilitado)</label>
                    <textarea 
                      className="premium-input"
                      style={{ padding: '10px 15px', minHeight: '180px', resize: 'vertical' }}
                      placeholder="Escribe o pega el resumen detallado aquí..."
                      value={shareManualContent}
                      onChange={(e) => setShareManualContent(e.target.value)}
                      required
                    />
                  </div>
                )}

                {shareContentType === 'flashcards' && (
                  <div className="form-group-premium" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label style={{ margin: 0 }}>Fichas de Estudio ({shareFlashcards.length})</label>
                      <button
                        type="button"
                        onClick={() => setShareFlashcards(prev => [...prev, { front: '', back: '' }])}
                        style={{
                          background: 'rgba(14, 165, 233, 0.1)',
                          border: 'none',
                          color: 'var(--primary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        + Añadir Ficha
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {shareFlashcards.map((card, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="premium-input"
                            style={{ paddingLeft: '10px', flex: 1, fontSize: '0.8rem' }}
                            placeholder="Frente (Pregunta)"
                            value={card.front}
                            onChange={(e) => {
                              const updated = [...shareFlashcards];
                              updated[idx].front = e.target.value;
                              setShareFlashcards(updated);
                            }}
                            required
                          />
                          <input
                            type="text"
                            className="premium-input"
                            style={{ paddingLeft: '10px', flex: 1, fontSize: '0.8rem' }}
                            placeholder="Reverso (Respuesta)"
                            value={card.back}
                            onChange={(e) => {
                              const updated = [...shareFlashcards];
                              updated[idx].back = e.target.value;
                              setShareFlashcards(updated);
                            }}
                            required
                          />
                          {shareFlashcards.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setShareFlashcards(prev => prev.filter((_, i) => i !== idx))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '5px'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="premium-actions" style={{ marginTop: '0' }}>
                <button type="button" className="btn-cancel-premium" onClick={() => setShowShareModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit-premium">
                  Publicar en el Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

const StarRating = ({ avgRating, userRating, onRate }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = hoverRating > 0 ? star <= hoverRating : star <= (userRating || Math.round(avgRating));
        return (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center'
            }}
            title={`Calificar con ${star} estrellas`}
          >
            <Star 
              size={15} 
              fill={isFilled ? '#f59e0b' : 'none'} 
              color={isFilled ? '#f59e0b' : 'var(--text-muted)'} 
              style={{ transition: 'all 0.15s ease' }}
            />
          </button>
        );
      })}
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '3px', fontWeight: 'bold' }}>
        ({avgRating.toFixed(1)})
      </span>
    </div>
  );
};

