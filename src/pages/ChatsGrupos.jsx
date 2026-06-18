import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageSquare, Plus, Users, Send, Copy, Check, X, Bell, BellOff, 
  BookOpen, HelpCircle, ShieldAlert, Sparkles, Hash, ArrowRight,
  Star, ChevronLeft, ChevronRight, Brain, PencilLine, Trash2, Loader,
  Flame, Trophy, Timer, Upload, Bot, UserCheck, Award, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useGroupChat } from '../context/GroupChatContext';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { marked } from 'marked';
import { supabase } from '../lib/supabase';
import { analyzeWhiteboardImage } from '../utils/aiVisionProcessor';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { extractTextFromPptx } from '../utils/pptxParser';
import { generateCustomQuiz } from '../utils/aiProcessor';
import { addStudyMinutes } from '../utils/studyTracker';
import { getSafeLocalStorage } from '../utils/storageSecurity';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function ChatsGrupos() {
  const { user } = useAuth();
  const { effectiveSchedule } = useSchedule();
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
    rateLibraryItem,
    deleteGroup
  } = useGroupChat();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' o 'solicitudes'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [customConfirm, setCustomConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [customAlert, setCustomAlert] = useState({ open: false, title: '', message: '' });

  // Form states
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [chatInputText, setChatInputText] = useState('');

  const uniqueSubjects = effectiveSchedule 
    ? Array.from(new Set(effectiveSchedule.filter(c => c && c.title).map(c => c.title)))
    : [];

  // UI States
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [versusInvite, setVersusInvite] = useState(null);

  const renderMemberAvatar = (avatarUrl, name, size = '36px', fontSize = '1rem') => {
    const isGradient = avatarUrl && avatarUrl.startsWith('linear-gradient');
    const hasAvatar = avatarUrl && !isGradient;

    if (hasAvatar) {
      return (
        <img 
          src={avatarUrl} 
          alt="Avatar" 
          style={{ 
            width: size, 
            height: size, 
            borderRadius: '50%', 
            objectFit: 'cover', 
            border: '1.5px solid var(--primary)',
            flexShrink: 0
          }}
        />
      );
    }

    const gradient = isGradient ? avatarUrl : 'linear-gradient(135deg, #8b5cf6, #38bdf8)';
    return (
      <div 
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: fontSize,
          border: '1.5px solid var(--primary)',
          flexShrink: 0
        }}
      >
        {(name || 'U').charAt(0).toUpperCase()}
      </div>
    );
  };

  const handleSenderClick = (msg) => {
    const member = activeGroupMembers.find(m => 
      (msg.user_id && m.user_id === msg.user_id) || 
      (!msg.user_id && m.user_name === msg.user_name)
    );
    if (member) {
      setSelectedMemberProfile(member);
    } else {
      setSelectedMemberProfile({
        user_name: msg.user_name,
        user_carrera: 'Miembro del Grupo',
        user_email: `${msg.user_name.toLowerCase().replace(' ', '')}@academica.cl`
      });
    }
  };

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

  // Reset subtab on group change and subscribe to general versus invitations
  useEffect(() => {
    const pendingActiveTab = localStorage.getItem('academic_group_pending_activetab');
    if (pendingActiveTab) {
      setActiveTab(pendingActiveTab);
      localStorage.removeItem('academic_group_pending_activetab');
    }

    const pendingSubTab = localStorage.getItem('academic_group_pending_subtab');
    if (pendingSubTab) {
      setGroupSubTab(pendingSubTab);
      localStorage.removeItem('academic_group_pending_subtab');
    } else {
      setGroupSubTab('chat');
    }
    setVersusInvite(null);

    if (!supabase || !activeGroupId || isFallbackMode) return;

    const channel = supabase.channel(`versus_general:${activeGroupId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'versus_created' }, ({ payload }) => {
        setVersusInvite(payload);
      })
      .on('broadcast', { event: 'game_started' }, () => {
        // Clear general invitation when the game starts to lock entry
        setVersusInvite(null);
      })
      .on('broadcast', { event: 'game_over' }, () => {
        setVersusInvite(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGroupId, isFallbackMode]);

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
    const saved = getSafeLocalStorage(`academic_${user.id}_notes_${activeGroup.asignatura}`, user.id, null);
    if (saved) {
      setUserNotes(saved);
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

  const handleSaveWhiteboardAnalysisAsNote = (analysisMarkdown) => {
    if (!user || !activeGroup) return;
    const noteTitle = `Análisis de Pizarra - ${activeGroup.titulo}`;
    const subjectName = activeGroup.asignatura;
    
    const savedNotes = getSafeLocalStorage(`academic_${user.id}_notes_${subjectName}`, user.id, null);
    const currentNotes = savedNotes ? savedNotes : [];
    
    const newNote = {
      id: `note-${Date.now()}`,
      title: noteTitle,
      content: analysisMarkdown,
      updatedAt: new Date().toISOString()
    };
    
    const updatedNotes = [newNote, ...currentNotes];
    localStorage.setItem(`academic_${user.id}_notes_${subjectName}`, JSON.stringify(updatedNotes));
    alert(`¡El análisis ha sido guardado exitosamente como una nota en tu cuaderno de "${subjectName}"!`);
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

  const handleDeleteGroupClick = () => {
    if (!activeGroup) return;
    const isCreator = activeGroup.creador_id === user.id;
    
    let title = isCreator ? "Eliminar / Salir del Grupo" : "Salir del Grupo";
    let message = "";
    if (isCreator) {
      if (activeGroupMembers.length > 1) {
        message = `¿Estás seguro de que deseas salir del grupo "${activeGroup.titulo}"? Al ser el creador, la propiedad del grupo se cederá automáticamente al miembro más antiguo.`;
      } else {
        message = `¿Estás seguro de que deseas eliminar el grupo "${activeGroup.titulo}"? Como eres el único miembro, esta acción lo borrará permanentemente con todos sus mensajes y biblioteca.`;
      }
    } else {
      message = `¿Estás seguro de que deseas salir del grupo "${activeGroup.titulo}"?`;
    }

    setCustomConfirm({
      open: true,
      title: title,
      message: message,
      onConfirm: async () => {
        setCustomConfirm(prev => ({ ...prev, open: false }));
        const success = await deleteGroup(activeGroup.id_grupo);
        if (success) {
          setCustomAlert({
            open: true,
            title: "Acción Completada",
            message: isCreator && activeGroupMembers.length <= 1 
              ? "Grupo eliminado permanentemente." 
              : "Has salido del grupo con éxito."
          });
        }
      }
    });
  };

  return (
    <main className="main-content height-constrained-page">
      <header style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <MessageSquare /> Chats de Asignaturas
            {isFallbackMode ? (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '3px 8px',
                borderRadius: '20px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                Modo Local (Offline)
              </span>
            ) : (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '3px 8px',
                borderRadius: '20px',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.3)'
              }}>
                Modo Online (Sincronizado)
              </span>
            )}
          </h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
            Crea salas de estudio para tus asignaturas, comparte códigos de invitación y debate con tus compañeros.
          </p>
        </div>

      </header>

      <div className={`chats-view-layout ${activeGroupId ? 'has-active-chat' : ''}`}>
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


        </aside>

        {/* VENTANA DE CHAT ACTIVO */}
        <section className="chats-main-window">
          {activeGroup ? (
            activeGroup.membership?.estado === 'aceptado' ? (
              <>
                {/* Header del Chat */}
                <header className="chats-header">
                  <div className="chats-header-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button 
                        type="button"
                        className="btn-back-to-groups" 
                        onClick={() => setActiveGroupId(null)}
                      >
                        <ChevronLeft size={16} /> Volver
                      </button>
                      <h3>{activeGroup.titulo}</h3>
                      <button
                        onClick={handleDeleteGroupClick}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)'
                        }}
                        title={activeGroup.creador_id === user.id ? "Borrar grupo" : "Salir del grupo"}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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

                {/* Sub Tab Selector (Mensajes / Biblioteca / Integrantes) */}
                <div className="group-tab-selector" style={{
                  display: 'flex',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
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
                      transition: '0.2s',
                      flexShrink: 0
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
                      transition: '0.2s',
                      flexShrink: 0
                    }}
                  >
                    <BookOpen size={15} /> Biblioteca
                  </button>
                  <button 
                    onClick={() => setGroupSubTab('members')}
                    style={{
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      color: groupSubTab === 'members' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: groupSubTab === 'members' ? '3px solid var(--primary)' : '3px solid transparent',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: '0.2s',
                      flexShrink: 0
                    }}
                  >
                    <Users size={15} /> Integrantes ({activeGroupMembers.length})
                  </button>
                  <button 
                    onClick={() => setGroupSubTab('board')}
                    style={{
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      color: groupSubTab === 'board' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: groupSubTab === 'board' ? '3px solid var(--primary)' : '3px solid transparent',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: '0.2s',
                      flexShrink: 0
                    }}
                  >
                    <PencilLine size={15} /> Pizarra (IA)
                  </button>
                  <button 
                    onClick={() => setGroupSubTab('versus')}
                    style={{
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      color: groupSubTab === 'versus' ? 'var(--primary)' : 'var(--text-muted)',
                      borderBottom: groupSubTab === 'versus' ? '3px solid var(--primary)' : '3px solid transparent',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: '0.2s',
                      flexShrink: 0
                    }}
                  >
                    <Flame size={15} /> Versus (IA)
                  </button>
                </div>

                {versusInvite && groupSubTab !== 'versus' && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))',
                    backdropFilter: 'blur(10px)',
                    borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{
                        background: 'var(--primary)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        flexShrink: 0
                      }}>
                        <Flame size={16} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          ¡Versus de Contenido Activo!
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Creado por <strong>{versusInvite.creatorName}</strong> ({versusInvite.numQuestions} preguntas, de "{versusInvite.documentName}")
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setGroupSubTab('versus')}
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Unirse a la Sala
                    </button>
                  </div>
                )}

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

                          if (msg.texto && msg.texto.startsWith('VERSUS_LOBBY:')) {
                            const parts = msg.texto.split(':');
                            const gameId = parts[1];
                            const creatorName = parts[2];
                            const numQuestions = parts[3];
                            const docName = parts.slice(4).join(':');

                            const isStarted = messages.some(m => m.texto && m.texto.trim() === `VERSUS_STARTED:${gameId}`);
                            const isFinished = messages.some(m => m.texto && m.texto.trim() === `VERSUS_FINISHED:${gameId}`);

                            return (
                              <div 
                                key={msg.id_mensaje || i} 
                                style={{
                                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                                  margin: '10px 0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: isMe ? 'flex-end' : 'flex-start'
                                }}
                              >
                                {!isMe && (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>
                                    {msg.user_name}
                                  </span>
                                )}
                                <div style={{
                                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
                                  backdropFilter: 'blur(10px)',
                                  border: '1.5px solid rgba(139, 92, 246, 0.3)',
                                  borderRadius: '16px',
                                  padding: '16px',
                                  maxWidth: '300px',
                                  boxShadow: 'var(--shadow-md)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background: 'var(--primary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white'
                                    }}>
                                      <Flame size={14} />
                                    </div>
                                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                      ¡Competencia Versus!
                                    </span>
                                  </div>
                                  
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <p style={{ margin: 0 }}>Organiza: <strong>{creatorName}</strong></p>
                                    <p style={{ margin: 0 }}>Tema: <strong>{docName}</strong></p>
                                    <p style={{ margin: 0 }}>Preguntas: <strong>{numQuestions}</strong></p>
                                    <p style={{ margin: 0 }}>Fecha: <strong>{new Date(msg.fecha_envio).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong></p>
                                    <p style={{ margin: 0 }}>Hora: <strong>{new Date(msg.fecha_envio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></p>
                                  </div>

                                  <button
                                    disabled={isFinished}
                                    onClick={() => {
                                      if (isFinished) return;
                                      setVersusInvite({
                                        gameId,
                                        creatorId: msg.user_id,
                                        creatorName,
                                        documentName: docName,
                                        numQuestions: parseInt(numQuestions),
                                        quizQuestions: []
                                      });
                                      setGroupSubTab('versus');
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: 'bold',
                                      borderRadius: '8px',
                                      background: isFinished ? 'rgba(255, 255, 255, 0.05)' : 'var(--primary)',
                                      color: isFinished ? 'var(--text-muted)' : 'white',
                                      border: isFinished ? '1px solid var(--border-color)' : 'none',
                                      cursor: isFinished ? 'not-allowed' : 'pointer',
                                      pointerEvents: isFinished ? 'none' : 'auto',
                                      textAlign: 'center',
                                      width: '100%',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {isFinished ? 'Partida Finalizada' : 'Unirse a la Batalla'}
                                  </button>
                                </div>
                                <span className="chats-message-meta" style={{ marginTop: '4px' }}>
                                  {formatMessageTime(msg.fecha_envio)}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={msg.id_mensaje || i} 
                              className={`chats-message-wrapper ${isMe ? 'outgoing' : 'incoming'}`}
                            >
                              {!isMe && (
                                <span 
                                  className="chats-message-sender"
                                  onClick={() => handleSenderClick(msg)}
                                  style={{ 
                                    cursor: 'pointer', 
                                    fontWeight: 'bold',
                                    color: 'var(--primary)',
                                    display: 'block',
                                    marginBottom: '4px'
                                  }}
                                  onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                                  onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                                >
                                  {msg.user_name}
                                </span>
                              )}
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
                ) : groupSubTab === 'library' ? (
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
                ) : groupSubTab === 'members' ? (
                  /* Vista de Integrantes */
                  <div className="chats-members-area" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.05)',
                    padding: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '800' }}>
                      Integrantes del Grupo ({activeGroupMembers.length})
                    </h4>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '15px',
                      overflowY: 'auto',
                      flex: 1,
                      alignContent: 'start'
                    }}>
                      {activeGroupMembers.map((member) => (
                        <div 
                          key={member.id_miembro}
                          onClick={() => setSelectedMemberProfile(member)}
                          style={{
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                          }}
                        >
                           {renderMemberAvatar(
                            member.user_id === user?.id ? (user?.user_metadata?.avatar_url || member.user_avatar) : member.user_avatar, 
                            member.user_id === user?.id ? (user?.user_metadata?.full_name || member.user_name) : member.user_name, 
                            '44px', 
                            '1.2rem'
                          )}
                          <div style={{ overflow: 'hidden', textAlign: 'left', flexGrow: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-main)', maxWidth: '120px' }}>
                                {member.user_id === user?.id ? (user?.user_metadata?.full_name || member.user_name) : member.user_name}
                              </p>
                              {activeGroup && member.user_id === activeGroup.creador_id && (
                                <span style={{
                                  display: 'inline-block',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#f59e0b',
                                  fontSize: '0.62rem',
                                  fontWeight: 'bold',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(245, 158, 11, 0.3)'
                                }}>
                                  Creador
                                </span>
                              )}
                            </div>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {member.user_id === user?.id ? (user?.user_metadata?.carrera || member.user_carrera) : (member.user_carrera || 'Estudiante')}
                            </p>
                            {member.user_id === user?.id && (
                              <span style={{
                                display: 'inline-block',
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: 'var(--primary)',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginTop: '4px'
                              }}>
                                Tú
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : groupSubTab === 'versus' ? (
                  <GroupVersus
                    activeGroupId={activeGroupId}
                    activeGroup={activeGroup}
                    user={user}
                    isFallbackMode={isFallbackMode}
                    activeGroupMembers={activeGroupMembers}
                    versusInvite={versusInvite}
                    setVersusInvite={setVersusInvite}
                    sendGroupMessage={sendGroupMessage}
                    messages={messages}
                  />
                ) : (
                  /* Vista de Pizarra */
                  <GroupWhiteboard 
                    activeGroupId={activeGroupId}
                    activeGroup={activeGroup}
                    user={user}
                    isFallbackMode={isFallbackMode}
                    onSaveNote={handleSaveWhiteboardAnalysisAsNote}
                  />
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
                  placeholder="Ej: Grupo de Estudio"
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-premium">
                <label>Asignatura</label>
                {uniqueSubjects.length > 0 ? (
                  <select 
                    className="premium-input"
                    style={{ paddingLeft: '15px', background: 'var(--bg)', color: 'var(--text-main)' }}
                    value={newGroupSubject}
                    onChange={(e) => setNewGroupSubject(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecciona una asignatura</option>
                    {uniqueSubjects.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    className="premium-input"
                    style={{ paddingLeft: '15px' }}
                    placeholder="Ej: Cálculo I"
                    value={newGroupSubject}
                    onChange={(e) => setNewGroupSubject(e.target.value)}
                    required
                  />
                )}
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

      {/* Profile Viewer Modal */}
      {selectedMemberProfile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)'
        }}>
          <div className="premium-modal" style={{ maxWidth: '440px', width: '90%', display: 'flex', flexDirection: 'column', position: 'relative', padding: '24px' }}>
            <button 
              onClick={() => setSelectedMemberProfile(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', marginTop: '10px' }}>
              {renderMemberAvatar(selectedMemberProfile.user_avatar, selectedMemberProfile.user_name, '90px', '2.5rem')}
              
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                  {selectedMemberProfile.user_name}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>
                  {selectedMemberProfile.user_carrera || 'Estudiante'}
                </p>
                {selectedMemberProfile.user_universidad && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {selectedMemberProfile.user_universidad} {selectedMemberProfile.user_anio ? `(${selectedMemberProfile.user_anio})` : ''}
                  </p>
                )}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '20px 0' }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                  Correo Electrónico
                </span>
                <a 
                  href={`mailto:${selectedMemberProfile.user_email}`}
                  style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {selectedMemberProfile.user_email}
                </a>
              </div>

              {selectedMemberProfile.user_bio && (
                <div>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                    Sobre Mí / Nota de Estudio
                  </span>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {selectedMemberProfile.user_bio}
                  </p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setSelectedMemberProfile(null)}
              className="btn-primary"
              style={{ 
                marginTop: '24px', 
                width: '100%', 
                padding: '12px', 
                borderRadius: '10px', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                background: 'var(--primary)',
                border: 'none',
                color: '#fff'
              }}
            >
              Cerrar Perfil
            </button>
          </div>
        </div>
      )}

      {customConfirm.open && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setCustomConfirm(prev => ({ ...prev, open: false }))}>
          <div className="premium-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 800 }}>{customConfirm.title}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', fontWeight: 500 }}>{customConfirm.message}</p>
            <div className="premium-actions">
              <button 
                onClick={() => setCustomConfirm(prev => ({ ...prev, open: false }))} 
                className="btn-cancel-premium"
              >
                Cancelar
              </button>
              <button 
                onClick={customConfirm.onConfirm} 
                className="btn-submit-premium"
                style={{ background: '#ef4444' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {customAlert.open && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }} onClick={() => setCustomAlert(prev => ({ ...prev, open: false }))}>
          <div className="premium-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 800 }}>{customAlert.title}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', fontWeight: 500 }}>{customAlert.message}</p>
            <button 
              onClick={() => setCustomAlert(prev => ({ ...prev, open: false }))}
              className="btn-submit-premium"
              style={{ width: '100%', padding: '12px' }}
            >
              Aceptar
            </button>
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

const compressBoardImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

const drawAll = (ctx, lines, shapes, backgroundImageEl) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  const isDark = document.body.classList.contains('dark-mode');
  const bgCol = isDark ? '#1e293b' : '#ffffff';

  ctx.fillStyle = bgCol; 
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (backgroundImageEl) {
    ctx.drawImage(backgroundImageEl, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  lines.forEach(line => {
    if (line.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = (line.color === 'eraser' || line.color === '#1e293b') ? bgCol : line.color;
    ctx.lineWidth = line.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(line.points[0].x, line.points[0].y);
    for (let i = 1; i < line.points.length; i++) {
      ctx.lineTo(line.points[i].x, line.points[i].y);
    }
    ctx.stroke();
  });

  shapes.forEach(shape => {
    ctx.beginPath();
    ctx.strokeStyle = (shape.color === 'eraser' || shape.color === '#1e293b') ? bgCol : shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.fillStyle = 'transparent';
    
    if (shape.type === 'rect') {
      const w = shape.x1 - shape.x0;
      const h = shape.y1 - shape.y0;
      ctx.strokeRect(shape.x0, shape.y0, w, h);
    } else if (shape.type === 'circle') {
      const radius = Math.sqrt(Math.pow(shape.x1 - shape.x0, 2) + Math.pow(shape.y1 - shape.y0, 2));
      ctx.arc(shape.x0, shape.y0, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'line') {
      ctx.moveTo(shape.x0, shape.y0);
      ctx.lineTo(shape.x1, shape.y1);
      ctx.stroke();
    } else if (shape.type === 'text') {
      ctx.fillStyle = (shape.color === 'eraser' || shape.color === '#1e293b') ? bgCol : shape.color;
      ctx.font = '16px sans-serif';
      ctx.fillText(shape.text, shape.x0, shape.y0);
    }
  });
};

export function GroupWhiteboard({ activeGroupId, user, isFallbackMode, activeGroup, onSaveNote }) {
  const [tool, setTool] = useState('pencil'); 
  const [color, setColor] = useState('#38bdf8'); 
  const [strokeWidth, setStrokeWidth] = useState(3);
  
  const [isThemeDark, setIsThemeDark] = useState(() => document.body.classList.contains('dark-mode'));
  const [customConfirm, setCustomConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [customAlert, setCustomAlert] = useState({ open: false, title: '', message: '' });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsThemeDark(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [lines, setLines] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [stickies, setStickies] = useState([]);
  
  const [bgImageSrc, setBgImageSrc] = useState(null);
  
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const bgImgElement = useRef(null);
  const isDrawingRef = useRef(false);
  const currentPoints = useRef([]);
  const startCoords = useRef({ x: 0, y: 0 });
  const channelRef = useRef(null);
  const lastDrawMinutesAwardedRef = useRef(0);
  const lastActiveBroadcastRef = useRef(0);
  
  const [draggingStickyId, setDraggingStickyId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  const colors = ['#38bdf8', '#8b5cf6', '#ec4899', '#22c55e', '#eab308', isThemeDark ? '#ffffff' : '#0f172a'];
  
  useEffect(() => {
    loadBoard();
  }, [activeGroupId]);
  
  const loadBoard = async () => {
    setLines([]);
    setShapes([]);
    setStickies([]);
    setBgImageSrc(null);
    bgImgElement.current = null;
    setAiAnalysis('');
    setShowAiPanel(false);
    
    if (!user) return;
    const localKey = `academic_${user.id}_board_${activeGroupId}`;
    const localData = getSafeLocalStorage(localKey, user.id, null);
    let boardState = null;
    if (localData) {
      try {
        boardState = typeof localData === 'string' ? JSON.parse(localData) : localData;
        applyBoardState(boardState);
      } catch (err) {
        console.warn("Error parsing local board data:", err);
      }
    }
    
    if (supabase && activeGroupId && !isFallbackMode) {
      try {
        const { data, error } = await supabase
          .from('pizarras_grupos')
          .select('*')
          .eq('id_grupo', activeGroupId)
          .maybeSingle();
          
        if (!error && data && data.canvas_data) {
          const parsed = JSON.parse(data.canvas_data);
          applyBoardState(parsed);
          localStorage.setItem(localKey, data.canvas_data);
        }
      } catch (err) {
        console.warn("Fallo al cargar pizarra desde Supabase:", err);
      }
    }
  };
  
  const applyBoardState = (state) => {
    if (!state) return;
    setLines(state.lines || []);
    setShapes(state.shapes || []);
    setStickies(state.stickies || []);
    if (state.bgImageSrc) {
      setBgImageSrc(state.bgImageSrc);
      const img = new Image();
      img.src = state.bgImageSrc;
      img.onload = () => {
        bgImgElement.current = img;
        requestAnimationFrame(redraw);
      };
    } else {
      setBgImageSrc(null);
      bgImgElement.current = null;
      requestAnimationFrame(redraw);
    }
  };
  
  const saveBoard = async (updatedLines, updatedShapes, updatedStickies, updatedBg) => {
    const boardState = {
      lines: updatedLines,
      shapes: updatedShapes,
      stickies: updatedStickies,
      bgImageSrc: updatedBg
    };
    
    const jsonStr = JSON.stringify(boardState);
    if (user?.id) {
      localStorage.setItem(`academic_${user.id}_board_${activeGroupId}`, jsonStr);
    }
    
    if (supabase && activeGroupId && !isFallbackMode) {
      try {
        const { data: existing } = await supabase
          .from('pizarras_grupos')
          .select('id_pizarra')
          .eq('id_grupo', activeGroupId)
          .maybeSingle();
          
        if (existing) {
          await supabase
            .from('pizarras_grupos')
            .update({ canvas_data: jsonStr, updated_at: new Date().toISOString() })
            .eq('id_grupo', activeGroupId);
        } else {
          await supabase
            .from('pizarras_grupos')
            .insert([{ id_grupo: activeGroupId, canvas_data: jsonStr }]);
        }
      } catch (err) {
        console.warn("Error al guardar pizarra en Supabase:", err);
      }
    }
  };

  useEffect(() => {
    if (!supabase || !activeGroupId || isFallbackMode) return;

    const channel = supabase.channel(`pizarra:${activeGroupId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (payload.action === 'stroke') {
          setLines(prev => [...prev, payload.line]);
        } else if (payload.action === 'shape') {
          setShapes(prev => [...prev, payload.shape]);
        } else if (payload.action === 'clear') {
          setLines([]);
          setShapes([]);
          setStickies([]);
          setBgImageSrc(null);
          bgImgElement.current = null;
        } else if (payload.action === 'sync') {
          setLines(payload.lines || []);
          setShapes(payload.shapes || []);
          setStickies(payload.stickies || []);
          if (payload.bgImageSrc) {
            const img = new Image();
            img.src = payload.bgImageSrc;
            img.onload = () => {
              bgImgElement.current = img;
              setBgImageSrc(payload.bgImageSrc);
            };
          } else {
            bgImgElement.current = null;
            setBgImageSrc(null);
          }
        }
      })
      .on('broadcast', { event: 'sticky' }, ({ payload }) => {
        if (payload.action === 'update') {
          setStickies(payload.stickies);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeGroupId, isFallbackMode]);
  
  const broadcastDraw = (action, payloadData) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'draw',
        payload: { action, ...payloadData }
      });
    }
  };

  const triggerWhiteboardActiveBroadcast = () => {
    const now = Date.now();
    if (now - lastActiveBroadcastRef.current > 30000) {
      lastActiveBroadcastRef.current = now;
      
      if (supabase && activeGroupId && !isFallbackMode) {
        const notifyChannel = supabase.channel(`pizarra_notify:${activeGroupId}`);
        notifyChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            notifyChannel.send({
              type: 'broadcast',
              event: 'whiteboard_active',
              payload: { userId: user?.id, groupTitle: activeGroup?.titulo }
            });
          }
        });
      }

      try {
        const bc = new BroadcastChannel('academic_local_whiteboard');
        bc.postMessage({
          event: 'whiteboard_active',
          userId: user?.id,
          groupId: activeGroupId,
          groupTitle: activeGroup?.titulo
        });
        bc.close();
      } catch (e) {
        // Ignorar
      }
    }
  };

  const broadcastStickiesState = (updatedStickies) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'sticky',
        payload: { action: 'update', stickies: updatedStickies }
      });
    }
  };

  const redrawWithData = (drawLines, drawShapes, bgImg) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawAll(ctx, drawLines, drawShapes, bgImg);
  };

  const redraw = () => {
    redrawWithData(lines, shapes, bgImgElement.current);
  };

  useEffect(() => {
    redraw();
  }, [lines, shapes, bgImageSrc, isThemeDark]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    
    return { x, y };
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    isDrawingRef.current = true;
    startCoords.current = { x, y };

    if (tool === 'pencil' || tool === 'eraser') {
      currentPoints.current = [{ x, y }];
    } else if (tool === 'text') {
      isDrawingRef.current = false;
      const text = window.prompt("Ingresa el texto a escribir:");
      if (text && text.trim()) {
        const newShape = {
          type: 'text',
          text: text.trim(),
          x0: x,
          y0: y,
          color: tool === 'eraser' ? 'eraser' : color,
          strokeWidth
        };
        const updated = [...shapes, newShape];
        setShapes(updated);
        broadcastDraw('shape', { shape: newShape });
        saveBoard(lines, updated, stickies, bgImageSrc);
        triggerWhiteboardActiveBroadcast();
      }
    } else {
      currentPoints.current = [];
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getCanvasCoords(e);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (tool === 'pencil' || tool === 'eraser') {
      currentPoints.current.push({ x, y });
      
      redraw();
      ctx.beginPath();
      const activeBgCol = document.body.classList.contains('dark-mode') ? '#1e293b' : '#ffffff';
      ctx.strokeStyle = tool === 'eraser' ? activeBgCol : color;
      ctx.lineWidth = tool === 'eraser' ? strokeWidth * 4 : strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentPoints.current[0].x, currentPoints.current[0].y);
      for (let i = 1; i < currentPoints.current.length; i++) {
        ctx.lineTo(currentPoints.current[i].x, currentPoints.current[i].y);
      }
      ctx.stroke();
    } else if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      redraw();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      
      if (tool === 'rect') {
        const w = x - startCoords.current.x;
        const h = y - startCoords.current.y;
        ctx.strokeRect(startCoords.current.x, startCoords.current.y, w, h);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startCoords.current.x, 2) + Math.pow(y - startCoords.current.y, 2));
        ctx.arc(startCoords.current.x, startCoords.current.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'line') {
        ctx.moveTo(startCoords.current.x, startCoords.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const { x, y } = getCanvasCoords(e);

    if (tool === 'pencil' || tool === 'eraser') {
      if (currentPoints.current.length > 1) {
        const newLine = {
          points: currentPoints.current,
          color: tool === 'eraser' ? 'eraser' : color,
          strokeWidth: tool === 'eraser' ? strokeWidth * 4 : strokeWidth
        };
        const updated = [...lines, newLine];
        setLines(updated);
        broadcastDraw('stroke', { line: newLine });
        saveBoard(updated, shapes, stickies, bgImageSrc);
        triggerWhiteboardActiveBroadcast();

        const nowMs = Date.now();
        if (nowMs - lastDrawMinutesAwardedRef.current > 60000) {
          addStudyMinutes(user?.id, 1); // 1 active minute for drawing on whiteboard
          lastDrawMinutesAwardedRef.current = nowMs;
        }
      }
      currentPoints.current = [];
    } else if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      const newShape = {
        type: tool,
        x0: startCoords.current.x,
        y0: startCoords.current.y,
        x1: x,
        y1: y,
        color: color,
        strokeWidth
      };
      const updated = [...shapes, newShape];
      setShapes(updated);
      broadcastDraw('shape', { shape: newShape });
      saveBoard(lines, updated, stickies, bgImageSrc);
      triggerWhiteboardActiveBroadcast();

      const nowMs = Date.now();
      if (nowMs - lastDrawMinutesAwardedRef.current > 60000) {
        addStudyMinutes(user?.id, 1); // 1 active minute for drawing on whiteboard
        lastDrawMinutesAwardedRef.current = nowMs;
      }
    }
  };

  const createStickyNote = () => {
    const newSticky = {
      id: `sticky-${Date.now()}`,
      text: 'Nota adhesiva de estudio...',
      x: 150 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      color: '#fef08a'
    };
    const updated = [...stickies, newSticky];
    setStickies(updated);
    broadcastStickiesState(updated);
    saveBoard(lines, shapes, updated, bgImageSrc);
    addStudyMinutes(user?.id, 1); // 1 active minute for creating a sticky note
    triggerWhiteboardActiveBroadcast();
  };

  const handleStickyTextChange = (id, newText) => {
    const updated = stickies.map(s => s.id === id ? { ...s, text: newText } : s);
    setStickies(updated);
    broadcastStickiesState(updated);
    saveBoard(lines, shapes, updated, bgImageSrc);
  };

  const handleStickyColorChange = (id, newColor) => {
    const updated = stickies.map(s => s.id === id ? { ...s, color: newColor } : s);
    setStickies(updated);
    broadcastStickiesState(updated);
    saveBoard(lines, shapes, updated, bgImageSrc);
  };

  const deleteStickyNote = (id) => {
    const updated = stickies.filter(s => s.id !== id);
    setStickies(updated);
    broadcastStickiesState(updated);
    saveBoard(lines, shapes, updated, bgImageSrc);
  };

  const handleStickyMouseDown = (e, id, curX, curY) => {
    if (e.target.tagName.toLowerCase() === 'textarea' || e.target.closest('.sticky-controls')) return;
    setDraggingStickyId(id);
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left - curX,
      y: e.clientY - rect.top - curY
    };
  };

  const handleContainerMouseMove = (e) => {
    if (draggingStickyId) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.current.x;
      const y = e.clientY - rect.top - dragOffset.current.y;
      
      const newX = Math.max(0, Math.min(800 - 160, x));
      const newY = Math.max(0, Math.min(500 - 140, y));

      const updated = stickies.map(s => s.id === draggingStickyId ? { ...s, x: newX, y: newY } : s);
      setStickies(updated);
    }
  };

  const handleStickyMouseUp = () => {
    if (draggingStickyId) {
      setDraggingStickyId(null);
      broadcastStickiesState(stickies);
      saveBoard(lines, shapes, stickies, bgImageSrc);
    }
  };

  const handleImageImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedBase64 = await compressBoardImage(file);
      setBgImageSrc(compressedBase64);
      
      const img = new Image();
      img.src = compressedBase64;
      img.onload = () => {
        bgImgElement.current = img;
        redraw();
        saveBoard(lines, shapes, stickies, compressedBase64);
        broadcastDraw('sync', { lines, shapes, stickies, bgImageSrc: compressedBase64 });
      };
    } catch (err) {
      console.error("Error reading file:", err);
      alert("Error al cargar la imagen de pizarra.");
    }
  };

  const clearBoard = () => {
    if (!window.confirm("¿Seguro que deseas borrar todo el contenido de la pizarra?")) return;
    setLines([]);
    setShapes([]);
    setStickies([]);
    setBgImageSrc(null);
    bgImgElement.current = null;
    redrawWithData([], [], null);
    saveBoard([], [], [], null);
    broadcastDraw('clear', {});
  };

  const handleAnalyzeBoard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setAnalyzing(true);
    setShowAiPanel(true);
    setAiAnalysis('');

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      drawAll(tempCtx, lines, shapes, bgImgElement.current);

      stickies.forEach(sticky => {
        tempCtx.fillStyle = sticky.color || '#fef08a';
        tempCtx.shadowColor = 'rgba(0,0,0,0.3)';
        tempCtx.shadowBlur = 8;
        tempCtx.shadowOffsetX = 3;
        tempCtx.shadowOffsetY = 3;
        
        const w = 150;
        const h = 120;
        tempCtx.fillRect(sticky.x, sticky.y, w, h);
        
        tempCtx.strokeStyle = 'rgba(0,0,0,0.1)';
        tempCtx.lineWidth = 1;
        tempCtx.strokeRect(sticky.x, sticky.y, w, h);

        tempCtx.shadowBlur = 0;
        tempCtx.shadowOffsetX = 0;
        tempCtx.shadowOffsetY = 0;
        tempCtx.fillStyle = '#0f172a';
        tempCtx.font = 'bold 11px sans-serif';
        
        const words = sticky.text.split(' ');
        let line = '';
        let yCoord = sticky.y + 20;
        const maxWidth = w - 20;
        const lineHeight = 15;

        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + ' ';
          let metrics = tempCtx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            tempCtx.fillText(line, sticky.x + 10, yCoord);
            line = words[n] + ' ';
            yCoord += lineHeight;
          } else {
            line = testLine;
          }
        }
        tempCtx.fillText(line, sticky.x + 10, yCoord);
      });

      const dataUrl = tempCanvas.toDataURL('image/png');
      const analysisMarkdown = await analyzeWhiteboardImage(dataUrl);
      setAiAnalysis(analysisMarkdown);
    } catch (err) {
      console.error(err);
      setAiAnalysis(`❌ Error al analizar la pizarra: ${err.message || err}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveNoteAction = () => {
    if (aiAnalysis && onSaveNote) {
      onSaveNote(aiAnalysis);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: showAiPanel ? '1fr 340px' : '1fr',
      flex: 1,
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        overflowY: 'auto',
        position: 'relative',
        background: 'var(--bg)'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--card-bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1.5px solid var(--border-color)',
          padding: '8px 15px',
          borderRadius: '12px',
          marginBottom: '15px',
          zIndex: 100,
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)'
        }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'pencil', label: 'Lápiz', icon: PencilLine },
              { id: 'eraser', label: 'Borrador', icon: Trash2 },
              { id: 'rect', label: 'Cuadrado', icon: () => <span style={{ width: '12px', height: '12px', border: '2px solid currentColor', display: 'inline-block' }}></span> },
              { id: 'circle', label: 'Círculo', icon: () => <span style={{ width: '12px', height: '12px', border: '2px solid currentColor', borderRadius: '50%', display: 'inline-block' }}></span> },
              { id: 'line', label: 'Línea', icon: () => <span style={{ width: '14px', height: '2px', background: 'currentColor', display: 'inline-block', transform: 'rotate(-45deg)' }}></span> },
              { id: 'text', label: 'Texto', icon: () => <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>T</span> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  background: tool === t.id ? 'var(--primary)' : 'transparent',
                  color: tool === t.id ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  transition: '0.2s'
                }}
              >
                {typeof t.icon === 'function' ? t.icon() : <t.icon size={16} />}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {colors.map(c => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pencil');
                }}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: c,
                  border: color === c && tool !== 'eraser' ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transform: color === c && tool !== 'eraser' ? 'scale(1.2)' : 'scale(1)',
                  transition: '0.15s'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grosor:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              style={{ width: '60px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', width: '16px', fontWeight: 'bold' }}>{strokeWidth}</span>
          </div>

          <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '10px' }}>
            <button
              className="btn-secondary"
              onClick={createStickyNote}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.2)',
                color: '#fef08a'
              }}
            >
              📝 +Nota
            </button>
            <button
              className="btn-secondary"
              onClick={handleImageImportClick}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              🖼️ Fondo
            </button>
            <button
              className="btn-secondary"
              onClick={clearBoard}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171'
              }}
            >
              🧹 Limpiar
            </button>
            <button
              onClick={handleAnalyzeBoard}
              disabled={analyzing}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {analyzing ? <Loader size={12} className="spinner" /> : <Sparkles size={12} />} Analizar con IA
            </button>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

        <div
          ref={containerRef}
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleStickyMouseUp}
          onMouseLeave={handleStickyMouseUp}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '800px',
            height: '500px',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid var(--border-color)',
            boxShadow: 'var(--shadow-xl)',
            background: 'var(--card-bg)'
          }}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              cursor: tool === 'pencil' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'default'
            }}
          />

          {stickies.map((sticky) => (
            <div
              key={sticky.id}
              onMouseDown={(e) => handleStickyMouseDown(e, sticky.id, sticky.x, sticky.y)}
              style={{
                position: 'absolute',
                left: `${sticky.x}px`,
                top: `${sticky.y}px`,
                width: '150px',
                background: sticky.color,
                borderRadius: '8px',
                padding: '8px 10px',
                boxShadow: '5px 5px 15px rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                cursor: draggingStickyId === sticky.id ? 'grabbing' : 'grab',
                zIndex: draggingStickyId === sticky.id ? 1000 : 10,
                boxSizing: 'border-box'
              }}
            >
              <div className="sticky-controls" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                paddingBottom: '4px',
                userSelect: 'none'
              }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'].map(col => (
                    <button
                      key={col}
                      onClick={() => handleStickyColorChange(sticky.id, col)}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: col,
                        border: '1px solid rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => deleteStickyNote(sticky.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '0 3px'
                  }}
                  title="Eliminar nota"
                >
                  ✕
                </button>
              </div>

              <textarea
                value={sticky.text}
                onChange={(e) => handleStickyTextChange(sticky.id, e.target.value)}
                placeholder="Anotar idea..."
                style={{
                  width: '100%',
                  height: '70px',
                  background: 'transparent',
                  border: 'none',
                  resize: 'none',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  color: '#0f172a',
                  outline: 'none',
                  fontWeight: '600',
                  lineHeight: '1.3'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {showAiPanel && (
        <div style={{
          borderLeft: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '15px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 'bold' }}>Reporte de Pizarra IA</h3>
            </div>
            <button
              onClick={() => setShowAiPanel(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontSize: '0.85rem', lineHeight: '1.6' }}>
            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '15px', color: 'var(--text-muted)' }}>
                <Loader size={36} className="spinner" color="var(--primary)" />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', margin: 0 }}>Analizando Pizarra...</p>
                  <span style={{ fontSize: '0.75rem' }}>Gemini está interpretando tus dibujos y notas adhesivas.</span>
                </div>
              </div>
            ) : aiAnalysis ? (
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(aiAnalysis) }} />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Haz clic en "Analizar con IA" para obtener un reporte estructurado.</p>
            )}
          </div>

          {aiAnalysis && !analyzing && (
            <div style={{
              padding: '15px 20px',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.08)',
              flexShrink: 0
            }}>
              <button
                className="btn-primary"
                onClick={handleSaveNoteAction}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px' }}
              >
                <Plus size={16} /> Guardar como Apunte
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. CUSTOM CONFIRM MODAL */}
      {customConfirm.open && (
        <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setCustomConfirm(prev => ({ ...prev, open: false }))}>
          <div className="premium-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%', padding: '24px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: 'var(--shadow-md)', textAlign: 'center', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px', color: '#f59e0b' }}>
              <AlertCircle size={48} />
            </div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 800 }}>{customConfirm.title}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', fontWeight: 500 }}>{customConfirm.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setCustomConfirm(prev => ({ ...prev, open: false }))} 
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button 
                onClick={customConfirm.onConfirm}
                className="btn-primary"
                style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, background: '#ef4444', border: 'none', color: 'white', boxShadow: 'none' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CUSTOM ALERT MODAL */}
      {customAlert.open && (
        <div className="modal-overlay" style={{ zIndex: 2100 }} onClick={() => setCustomAlert(prev => ({ ...prev, open: false }))}>
          <div className="premium-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '24px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '24px', boxShadow: 'var(--shadow-md)', textAlign: 'center', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px', color: '#10b981' }}>
              <CheckCircle2 size={48} />
            </div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: 800 }}>{customAlert.title}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', fontWeight: 500 }}>{customAlert.message}</p>
            <button 
              onClick={() => setCustomAlert(prev => ({ ...prev, open: false }))}
              className="btn-primary"
              style={{ padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, width: '100%', display: 'block', margin: '0 auto' }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupVersus({ activeGroupId, activeGroup, user, isFallbackMode, activeGroupMembers, versusInvite, setVersusInvite, sendGroupMessage, messages }) {
  const [gameState, setGameState] = useState('setup'); // 'setup' | 'lobby' | 'playing' | 'question_results' | 'podium'
  const [file, setFile] = useState(null);
  const [fileParsing, setFileParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [timer, setTimer] = useState(15);
  const [myAnswerIdx, setMyAnswerIdx] = useState(-1);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [activeGameId, setActiveGameId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedHistoryBattle, setSelectedHistoryBattle] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const channelRef = useRef(null);
  const generalChannelRef = useRef(null);
  const fileInputRef = useRef(null);
  const playersRef = useRef(players);
  const currentQuestionIdxRef = useRef(currentQuestionIdx);
  const quizQuestionsRef = useRef(quizQuestions);
  const timerRef = useRef(timer);
  const isHostRef = useRef(isHost);
  const gameStateRef = useRef(gameState);
  const userRef = useRef(user);
  const fileRef = useRef(file);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    currentQuestionIdxRef.current = currentQuestionIdx;
  }, [currentQuestionIdx]);

  useEffect(() => {
    quizQuestionsRef.current = quizQuestions;
  }, [quizQuestions]);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    fileRef.current = file;
  }, [file]);

  // General Channel subscription for Versus lobby creation/start/end events
  useEffect(() => {
    if (!supabase || !activeGroupId || isFallbackMode) return;

    const genChan = supabase.channel(`versus_general:${activeGroupId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    genChan.subscribe();
    generalChannelRef.current = genChan;

    return () => {
      supabase.removeChannel(genChan);
      generalChannelRef.current = null;
    };
  }, [activeGroupId, isFallbackMode]);

  // Sync state if invite is present
  useEffect(() => {
    if (versusInvite && !activeGameId) {
      // Check if current user is the creator (re-entry)
      const isUserCreator = versusInvite.creatorId === user?.id;
      if (isUserCreator) {
        // Restore questions from localStorage
        const savedQuestions = localStorage.getItem(`versus_questions_${versusInvite.gameId}`);
        const restoredQuestions = savedQuestions ? JSON.parse(savedQuestions) : versusInvite.quizQuestions || [];
        
        setActiveGameId(versusInvite.gameId);
        setQuizQuestions(restoredQuestions);
        setIsHost(true);
        setGameState('lobby');
        
        const hostPlayer = {
          id: user?.id || 'host-local',
          name: user?.user_metadata?.nombre || user?.email || 'Organizador',
          score: 0,
          lastScoreChange: 0,
          isBot: false,
          isHost: true,
          answered: false,
          correct: false
        };
        
        setPlayers([hostPlayer]);
      } else if (!isHost) {
        setActiveGameId(versusInvite.gameId);
        setQuizQuestions(versusInvite.quizQuestions);
        setIsHost(false);
        setGameState('lobby');
        
        const myPlayer = {
          id: user?.id || 'player-' + Math.random().toString(36).substr(2, 5),
          name: user?.user_metadata?.nombre || user?.email || 'Estudiante',
          score: 0,
          lastScoreChange: 0,
          isBot: false,
          isHost: false,
          answered: false,
          correct: false
        };
        
        setPlayers([myPlayer]);

        // Join the channel and send discover after subscription
        setTimeout(() => {
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'player_joined',
              payload: {
                gameId: versusInvite.gameId,
                player: myPlayer
              }
            });
            channelRef.current.send({
              type: 'broadcast',
              event: 'game_discover',
              payload: { gameId: versusInvite.gameId }
            });
          }
        }, 500);
      }
    }
  }, [versusInvite, activeGameId, isHost, user]);

  // Supabase Broadcast Channel logic
  useEffect(() => {
    if (!supabase || !activeGroupId || isFallbackMode || !activeGameId) return;

    const channel = supabase.channel(`versus_game:${activeGameId}`, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'game_discover' }, () => {
        if (isHostRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'game_info',
            payload: {
              gameId: activeGameId,
              creatorId: userRef.current?.id,
              creatorName: userRef.current?.user_metadata?.nombre || userRef.current?.email || 'Organizador',
              numQuestions: quizQuestionsRef.current.length,
              documentName: fileRef.current?.name || 'Contenido',
              quizQuestions: quizQuestionsRef.current,
              players: playersRef.current,
              status: gameStateRef.current === 'lobby' ? 'lobby' : 'playing'
            }
          });
        }
      })
      .on('broadcast', { event: 'game_info' }, ({ payload }) => {
        if (!isHostRef.current) {
          setQuizQuestions(payload.quizQuestions);
          setPlayers(payload.players);
          if (payload.status === 'playing' && gameStateRef.current === 'lobby') {
            setGameState('playing');
            setTimer(15);
          }
        }
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        setPlayers(prev => {
          if (prev.some(pl => pl.id === payload.player.id)) return prev;
          const next = [...prev, payload.player];
          if (isHostRef.current) {
            channel.send({
              type: 'broadcast',
              event: 'game_info',
              payload: {
                gameId: activeGameId,
                creatorId: userRef.current?.id,
                creatorName: userRef.current?.user_metadata?.nombre || userRef.current?.email || 'Organizador',
                numQuestions: quizQuestionsRef.current.length,
                documentName: fileRef.current?.name || 'Contenido',
                quizQuestions: quizQuestionsRef.current,
                players: next,
                status: 'lobby'
              }
            });
          }
          return next;
        });
      })
      .on('broadcast', { event: 'game_started' }, () => {
        if (!isHostRef.current) {
          setGameState('playing');
          setCurrentQuestionIdx(0);
          setTimer(15);
          setMyAnswerIdx(-1);
          setHasAnswered(false);
          setPlayers(prev => prev.map(p => ({ ...p, score: 0, lastScoreChange: 0, answered: false, correct: false })));
        }
      })
      .on('broadcast', { event: 'player_submitted' }, ({ payload }) => {
        setPlayers(prev => prev.map(pl => {
          if (pl.id === payload.playerId) {
            return {
              ...pl,
              score: payload.score,
              lastScoreChange: payload.lastScoreChange,
              answered: true,
              correct: payload.isCorrect
            };
          }
          return pl;
        }));
      })
      .on('broadcast', { event: 'next_question' }, ({ payload }) => {
        if (!isHostRef.current) {
          setCurrentQuestionIdx(payload.nextQuestionIdx);
          setPlayers(prev => prev.map(p => ({ ...p, answered: false, correct: false, lastScoreChange: 0 })));
          setMyAnswerIdx(-1);
          setHasAnswered(false);
          setGameState('playing');
          setTimer(15);
        }
      })
      .on('broadcast', { event: 'show_results' }, ({ payload }) => {
        if (!isHostRef.current) {
          setPlayers(payload.players);
          setGameState('question_results');
          setTimer(5);
        }
      })
      .on('broadcast', { event: 'timer_tick' }, ({ payload }) => {
        if (!isHostRef.current) {
          setTimer(payload.timer);
          if (payload.gameState && payload.gameState !== gameStateRef.current) {
            setGameState(payload.gameState);
          }
          if (payload.currentQuestionIdx !== undefined && payload.currentQuestionIdx !== currentQuestionIdxRef.current) {
            setCurrentQuestionIdx(payload.currentQuestionIdx);
          }
        }
      })
      .on('broadcast', { event: 'game_over' }, ({ payload }) => {
        if (!isHostRef.current) {
          if (payload.players) {
            setPlayers(payload.players);
          }
          setGameState('podium');
          setVersusInvite(null);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeGameId, isFallbackMode, activeGroupId, setVersusInvite]);

  // Host clean up on window unload
  useEffect(() => {
    const handleUnload = () => {
      if (isHost && activeGameId && activeGroupId) {
        if (generalChannelRef.current) {
          generalChannelRef.current.send({
            type: 'broadcast',
            event: 'game_over',
            payload: { gameId: activeGameId }
          });
        }
        if (sendGroupMessage) {
          sendGroupMessage(activeGroupId, `VERSUS_FINISHED:${activeGameId}`).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isHost, activeGameId, activeGroupId, sendGroupMessage]);

  // Timer loop for countdown in playing state (synchronized, Host only)
  useEffect(() => {
    if (gameState !== 'playing' || !isHost || !activeGameId) return;

    setTimer(15);
    timerRef.current = 15;

    const interval = setInterval(() => {
      const currentVal = timerRef.current;
      if (currentVal <= 1) {
        clearInterval(interval);
        setGameState('question_results');
        setTimer(5);
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'show_results',
            payload: {
              gameId: activeGameId,
              players: playersRef.current
            }
          });
        }
      } else {
        const newVal = currentVal - 1;
        timerRef.current = newVal;
        setTimer(newVal);
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'timer_tick',
            payload: {
              gameId: activeGameId,
              timer: newVal,
              gameState: 'playing',
              currentQuestionIdx: currentQuestionIdxRef.current
            }
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, isHost, activeGameId]);

  // Fast-forward to results if all players answered (Host only, synchronized)
  useEffect(() => {
    if (gameState !== 'playing' || !isHost || !activeGameId) return;
    const allAnswered = players.every(p => p.answered);
    if (allAnswered && players.length > 0) {
      setGameState('question_results');
      setTimer(5);
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'show_results',
          payload: {
            gameId: activeGameId,
            players: players
          }
        });
      }
    }
  }, [players, gameState, isHost, activeGameId]);

  // Results screen countdown loop (Host only)
  useEffect(() => {
    if (gameState !== 'question_results' || !isHost || !activeGameId) return;

    setTimer(5);
    timerRef.current = 5;

    const interval = setInterval(() => {
      const currentVal = timerRef.current;
      if (currentVal <= 1) {
        clearInterval(interval);
        
        const qIdx = currentQuestionIdxRef.current;
        const qLength = quizQuestionsRef.current.length;
        
        if (qIdx < qLength - 1) {
          const nextIdx = qIdx + 1;
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'next_question',
              payload: {
                gameId: activeGameId,
                nextQuestionIdx: nextIdx
              }
            });
          }
          setCurrentQuestionIdx(nextIdx);
          setPlayers(prevPlayers => prevPlayers.map(p => ({ ...p, answered: false, correct: false, lastScoreChange: 0 })));
          setMyAnswerIdx(-1);
          setHasAnswered(false);
          setGameState('playing');
          setTimer(15);
        } else {
          const historyData = {
            gameId: activeGameId,
            documentName: file?.name || versusInvite?.documentName || 'Apuntes',
            creatorName: user?.user_metadata?.nombre || user?.email || 'Organizador',
            timestamp: new Date().toISOString(),
            players: playersRef.current.map(p => ({ name: p.name, score: p.score, isBot: p.isBot })),
            questions: quizQuestionsRef.current
          };

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'game_over',
              payload: {
                gameId: activeGameId,
                players: playersRef.current,
                history: historyData
              }
            });
          }
          if (generalChannelRef.current) {
            generalChannelRef.current.send({
              type: 'broadcast',
              event: 'game_over',
              payload: { gameId: activeGameId }
            });
          }
          if (sendGroupMessage && activeGroupId) {
            sendGroupMessage(activeGroupId, `VERSUS_FINISHED:${activeGameId}`).catch(err => {
              console.warn("Error al enviar VERSUS_FINISHED:", err);
            });
            sendGroupMessage(activeGroupId, `VERSUS_HISTORY:${activeGameId}:${JSON.stringify(historyData)}`).catch(err => {
              console.warn("Error al enviar VERSUS_HISTORY:", err);
            });
          }
          setGameState('podium');
          setVersusInvite(null);
        }
      } else {
        const newVal = currentVal - 1;
        timerRef.current = newVal;
        setTimer(newVal);
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'timer_tick',
            payload: {
              gameId: activeGameId,
              timer: newVal,
              gameState: 'question_results',
              currentQuestionIdx: currentQuestionIdxRef.current
            }
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, isHost, activeGameId, file, versusInvite, user, sendGroupMessage, activeGroupId]);

  // Simulate bots responses
  useEffect(() => {
    if (!isHost || gameState !== 'playing') return;

    const currentQ = quizQuestions[currentQuestionIdx];
    if (!currentQ) return;

    const botTimeouts = [];

    players.forEach(p => {
      if (p.isBot && !p.answered) {
        let speedMin = 2, speedMax = 9, accuracy = 0.75;
        if (p.name.includes('Mateo')) { speedMin = 1.5; speedMax = 4.5; accuracy = 0.65; }
        else if (p.name.includes('Sofía')) { speedMin = 2.5; speedMax = 6.5; accuracy = 0.85; }
        else if (p.name.includes('Valeria')) { speedMin = 2; speedMax = 5.5; accuracy = 0.80; }
        else if (p.name.includes('Tomás')) { speedMin = 4; speedMax = 11; accuracy = 0.50; }
        else if (p.name.includes('Camila')) { speedMin = 3; speedMax = 8; accuracy = 0.65; }

        const delay = (Math.random() * (speedMax - speedMin) + speedMin) * 1000;

        const t = setTimeout(() => {
          const isCorrect = Math.random() < accuracy;
          const timeRemaining = Math.max(1, 15 - (delay / 1000));
          const scoreChange = isCorrect ? (500 + Math.round((timeRemaining / 15) * 500)) : 0;

          setPlayers(prev => {
            const next = prev.map(pl => {
              if (pl.id === p.id) {
                return {
                  ...pl,
                  score: pl.score + scoreChange,
                  lastScoreChange: scoreChange,
                  answered: true,
                  correct: isCorrect
                };
              }
              return pl;
            });

            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'player_submitted',
                payload: {
                  gameId: activeGameId,
                  playerId: p.id,
                  score: p.score + scoreChange,
                  isCorrect,
                  lastScoreChange: scoreChange
                }
              });
            }

            return next;
          });
        }, delay);

        botTimeouts.push(t);
      }
    });

    return () => botTimeouts.forEach(clearTimeout);
  }, [gameState, currentQuestionIdx, isHost, players, quizQuestions, activeGameId]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleCreateLobby = async () => {
    if (!file) {
      alert("Por favor selecciona un archivo.");
      return;
    }
    setFileParsing(true);
    setStatusMessage("Leyendo y extrayendo texto del documento localmente...");
    
    try {
      let text = "";
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map(item => item.str).join(' ') + '\n';
        }
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === 'pptx') {
        text = await extractTextFromPptx(file);
      } else if (ext === 'txt') {
        text = await file.text();
      } else {
        throw new Error("Formato no soportado. Sube PDF, DOCX, PPTX o TXT.");
      }

      const cleanText = text.trim();
      if (!cleanText) {
        throw new Error("El archivo no contiene texto legible.");
      }

      setFileParsing(false);
      setIsGenerating(true);
      setStatusMessage("Generando preguntas de competencia con IA Llama 3.1...");

      const generated = await generateCustomQuiz(cleanText, numQuestions);
      if (!generated || generated.length === 0) {
        throw new Error("No se pudo generar el quiz con IA.");
      }

      const gId = 'game-' + Date.now();
      localStorage.setItem(`versus_questions_${gId}`, JSON.stringify(generated));

      setQuizQuestions(generated);
      
      const hostPlayer = {
        id: user?.id || 'host-local',
        name: user?.user_metadata?.nombre || user?.email || 'Organizador',
        score: 0,
        lastScoreChange: 0,
        isBot: false,
        isHost: true,
        answered: false,
        correct: false
      };

      setPlayers([hostPlayer]);
      setIsHost(true);
      setActiveGameId(gId);
      setGameState('lobby');

    } catch (err) {
      console.error(err);
      alert("Error al inicializar Versus: " + err.message);
    } finally {
      setFileParsing(false);
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  const handleShareLobby = async () => {
    if (isShared) return;

    if (generalChannelRef.current) {
      generalChannelRef.current.send({
        type: 'broadcast',
        event: 'versus_created',
        payload: {
          gameId: activeGameId,
          creatorId: user?.id,
          creatorName: user?.user_metadata?.nombre || user?.email || 'Organizador',
          numQuestions: quizQuestions.length,
          documentName: file?.name || 'Apuntes',
          quizQuestions: quizQuestions
        }
      });
    }

    if (sendGroupMessage && activeGroupId) {
      try {
        await sendGroupMessage(
          activeGroupId,
          `VERSUS_LOBBY:${activeGameId}:${user?.user_metadata?.nombre || user?.email || 'Organizador'}:${quizQuestions.length}:${file?.name || 'Apuntes'}`
        );
      } catch (err) {
        console.warn("Error al enviar mensaje de Versus al chat:", err);
      }
    }

    setIsShared(true);
  };

  const handleAddBot = () => {
    const botNames = ['Sofía 🎓', 'Mateo ⚡', 'Valeria 🧠', 'Tomás ☕', 'Camila 🎨'];
    const existingNames = players.filter(p => p.isBot).map(p => p.name);
    const available = botNames.filter(name => !existingNames.includes(name));

    if (available.length === 0) {
      alert("Todos los bots de estudio ya están en la sala.");
      return;
    }

    const newBot = {
      id: 'bot-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: available[0],
      score: 0,
      lastScoreChange: 0,
      isBot: true,
      isHost: false,
      answered: false,
      correct: false
    };

    setPlayers(prev => {
      const next = [...prev, newBot];
      if (isHost && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'game_info',
          payload: {
            gameId: activeGameId,
            creatorId: user?.id,
            creatorName: user?.user_metadata?.nombre || user?.email || 'Organizador',
            numQuestions: quizQuestions.length,
            documentName: file?.name || 'Contenido',
            quizQuestions,
            players: next,
            status: 'lobby'
          }
        });
      }
      return next;
    });
  };

  const handleStartGame = () => {
    if (players.length < 2 && !confirm("¿Quieres iniciar la partida tú solo con los bots de IA?")) {
      return;
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_started',
        payload: { gameId: activeGameId }
      });
    }

    if (generalChannelRef.current) {
      generalChannelRef.current.send({
        type: 'broadcast',
        event: 'game_started',
        payload: { gameId: activeGameId }
      });
    }

    if (sendGroupMessage && activeGroupId) {
      sendGroupMessage(activeGroupId, `VERSUS_STARTED:${activeGameId}`).catch(err => {
        console.warn("Error al enviar VERSUS_STARTED:", err);
      });
    }

    setGameState('playing');
    setCurrentQuestionIdx(0);
    setTimer(15);
    setMyAnswerIdx(-1);
    setHasAnswered(false);
    setPlayers(prev => prev.map(p => ({ ...p, score: 0, lastScoreChange: 0, answered: false, correct: false })));
  };

  const handleSelectOption = (optionIdx) => {
    if (hasAnswered || gameState !== 'playing') return;

    setMyAnswerIdx(optionIdx);
    setHasAnswered(true);

    const currentQ = quizQuestions[currentQuestionIdx];
    const isCorrect = optionIdx === currentQ.respuestaCorrecta;
    const timeRemaining = timer;
    const scoreChange = isCorrect ? (500 + Math.round((timeRemaining / 15) * 500)) : 0;

    setPlayers(prev => {
      const next = prev.map(p => {
        if (p.id === user?.id) {
          return {
            ...p,
            score: p.score + scoreChange,
            lastScoreChange: scoreChange,
            answered: true,
            correct: isCorrect
          };
        }
        return p;
      });

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_submitted',
          payload: {
            gameId: activeGameId,
            playerId: user?.id,
            score: (players.find(pl => pl.id === user?.id)?.score || 0) + scoreChange,
            isCorrect,
            lastScoreChange: scoreChange
          }
        });
      }

      return next;
    });
  };

  const resetVersusGame = () => {
    if (isHost && activeGameId && sendGroupMessage && activeGroupId) {
      sendGroupMessage(activeGroupId, `VERSUS_FINISHED:${activeGameId}`).catch(err => {
        console.warn("Error al enviar VERSUS_FINISHED:", err);
      });
    }

    if (generalChannelRef.current) {
      generalChannelRef.current.send({
        type: 'broadcast',
        event: 'game_over',
        payload: { gameId: activeGameId }
      });
    }

    setGameState('setup');
    setFile(null);
    setQuizQuestions([]);
    setPlayers([]);
    setCurrentQuestionIdx(0);
    setTimer(15);
    setMyAnswerIdx(-1);
    setHasAnswered(false);
    setIsHost(false);
    setActiveGameId(null);
    setVersusInvite(null);
    setIsShared(false);
  };

  const handleJoinLobby = (lobby) => {
    resetVersusGame();
    setTimeout(() => {
      setVersusInvite({
        gameId: lobby.gameId,
        creatorName: lobby.creatorName,
        documentName: lobby.documentName,
        numQuestions: lobby.numQuestions,
        quizQuestions: []
      });
    }, 50);
  };

  const activeLobbies = [];
  const battleHistory = [];
  if (messages && Array.isArray(messages)) {
    messages.forEach(msg => {
      if (msg.texto && msg.texto.startsWith('VERSUS_LOBBY:')) {
        const parts = msg.texto.split(':');
        const gameId = parts[1];
        const creatorName = parts[2];
        const numQuestions = parts[3];
        const docName = parts.slice(4).join(':');
        
        // Excluir si la partida ya inició o finalizó
        const isLobbyStarted = messages.some(m => m.texto && m.texto.trim() === `VERSUS_STARTED:${gameId}`);
        const isLobbyFinished = messages.some(m => m.texto && m.texto.trim() === `VERSUS_FINISHED:${gameId}`);
        
        if (!isLobbyStarted && !isLobbyFinished) {
          if (!activeLobbies.some(lobby => lobby.gameId === gameId)) {
            activeLobbies.push({
              gameId,
              creatorName,
              numQuestions: parseInt(numQuestions),
              documentName: docName,
              timestamp: msg.fecha_envio || new Date().toISOString()
            });
          }
        }
      } else if (msg.texto && msg.texto.startsWith('VERSUS_HISTORY:')) {
        const parts = msg.texto.split(':');
        const gameId = parts[1];
        const historyJson = parts.slice(2).join(':');
        try {
          const history = JSON.parse(historyJson);
          if (!battleHistory.some(b => b.gameId === gameId)) {
            battleHistory.push(history);
          }
        } catch (e) {
          console.warn("Error parsing versus history JSON:", e);
        }
      }
    });
    activeLobbies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    battleHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const currentQ = quizQuestions[currentQuestionIdx];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      background: 'rgba(0, 0, 0, 0.05)',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {/* 1. SETUP STATE */}
      {gameState === 'setup' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}>
          {/* Header Row with Title and History Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '15px 25px',
            boxShadow: 'var(--shadow-md)',
            flexWrap: 'wrap',
            gap: '15px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={22} color="var(--primary)" /> Versus de Contenido IA
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Crea una sala subiendo un archivo o únete a las batallas activas de tus compañeros.
              </p>
            </div>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="premium-btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                color: 'var(--primary)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)'}
            >
              <Trophy size={16} /> Ver Historial de Batallas
            </button>
          </div>

          {/* columns row container */}
          <div style={{
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            width: '100%'
          }}>
            {/* COLUMNA IZQUIERDA: CREAR SALA */}
            <div style={{
              flex: '1 1 500px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '30px',
              boxShadow: 'var(--shadow-lg)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                <div style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '12px',
                  width: '45px',
                  height: '45px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0
                }}>
                  <Flame size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    Versus de Contenido IA
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Compite en tiempo real respondiendo preguntas generadas a partir de tus apuntes.
                  </p>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-muted)' }}>
                  1. Cargar Documento de Estudio (.pdf, .docx, .pptx, .txt)
                </label>
                
                <div 
                  onClick={() => fileInputRef.current.click()}
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '25px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: 'rgba(0, 0, 0, 0.02)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.02)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".pdf,.docx,.pptx,.txt" 
                    style={{ display: 'none' }} 
                  />
                  <Upload size={32} color="var(--primary)" style={{ opacity: 0.8, marginBottom: '10px' }} />
                  {file ? (
                    <div>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {file.name}
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB • Haz clic para cambiar archivo
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        Arrastra o haz clic para subir tus apuntes
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Formatos soportados: PDF, Word, PowerPoint o Texto
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-muted)' }}>
                  2. Cantidad de Preguntas
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[5, 10, 15].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumQuestions(num)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: numQuestions === num ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: numQuestions === num ? 'rgba(139, 92, 246, 0.08)' : 'var(--card-bg)',
                        color: numQuestions === num ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {num} Preguntas
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                {(fileParsing || isGenerating) ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px 0',
                    gap: '15px'
                  }}>
                    <Loader size={36} className="spinner" color="var(--primary)" />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        {statusMessage}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esto puede tardar unos segundos.</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateLobby}
                    disabled={!file}
                    className="premium-btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      cursor: file ? 'pointer' : 'not-allowed',
                      opacity: file ? 1 : 0.6
                    }}
                  >
                    Generar Sala Versus con IA
                  </button>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: SALAS ACTIVAS DISPONIBLES */}
            <div style={{
              flex: '1 1 400px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '30px',
              boxShadow: 'var(--shadow-lg)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                <div style={{
                  background: 'rgba(234, 179, 8, 0.1)',
                  borderRadius: '12px',
                  width: '45px',
                  height: '45px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0
                }}>
                  <Trophy size={24} color="var(--primary)" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    Salas Activas en el Chat
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Únete a una batalla creada por tus compañeros en este grupo.
                  </p>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px', 
                maxHeight: '400px', 
                overflowY: 'auto',
                paddingRight: '5px' 
              }}>
                {activeLobbies.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: 'rgba(0, 0, 0, 0.01)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-color)',
                    margin: 'auto 0'
                  }}>
                    <Users size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      No hay salas activas
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                      Pídele a un compañero que cree y comparta una sala, o crea una tú mismo a la izquierda.
                    </p>
                  </div>
                ) : (
                  activeLobbies.map((lobby) => {
                    const isCreatedByMe = lobby.creatorName === (user?.user_metadata?.nombre || user?.email);
                    return (
                      <div
                        key={lobby.gameId}
                        style={{
                          background: 'rgba(139, 92, 246, 0.03)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          transition: 'all 0.2s',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.03)';
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                            <span style={{
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              color: 'var(--text-main)',
                              lineHeight: '1.3',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {lobby.documentName}
                            </span>
                            <span style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              flexShrink: 0
                            }}>
                              Abierta
                            </span>
                          </div>
                          <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Creador: <strong>{lobby.creatorName} {isCreatedByMe && '(Tú)'}</strong>
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Preguntas: <strong>{lobby.numQuestions}</strong>
                          </p>
                        </div>

                        <button
                          onClick={() => handleJoinLobby(lobby)}
                          className="premium-btn-primary"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            width: '100%'
                          }}
                        >
                          <Flame size={14} /> Unirse a la Batalla
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>


        </div>
      )}

      {/* 2. LOBBY STATE */}
      {gameState === 'lobby' && (
        !isHost && quizQuestions.length === 0 ? (
          <div style={{
            maxWidth: '500px',
            width: '100%',
            margin: '40px auto',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '35px',
            boxShadow: 'var(--shadow-lg)',
            boxSizing: 'border-box',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <Loader size={44} className="spinner" color="var(--primary)" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Conectando con el organizador...
              </h2>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Obteniendo el set de preguntas y sincronizando la sala de Versus. Asegúrate de que el creador esté activo en el Versus.
              </p>
            </div>
            <button
              onClick={resetVersusGame}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'red';
                e.currentTarget.style.color = 'red';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
            >
              Cancelar y Salir
            </button>
          </div>
        ) : (
          <div style={{
            maxWidth: '700px',
            width: '100%',
            margin: '0 auto',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '25px',
            boxShadow: 'var(--shadow-lg)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <span style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: 'var(--primary)',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}>
                  Lobby / Sala de Espera
                </span>
                <h2 style={{ margin: '8px 0 0 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Versus: {file?.name || versusInvite?.documentName || 'Estudio Grupal'}
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Tema: {activeGroup?.asignatura || 'Competencia de Conocimiento'} • {quizQuestions.length} Preguntas
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {isHost && (
                  <button
                    onClick={handleAddBot}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Bot size={15} color="var(--primary)" /> Añadir Bot de IA
                  </button>
                )}
                <button
                  onClick={resetVersusGame}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    background: 'transparent',
                    color: '#ef4444',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Salir
                </button>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '15px 0' }} />

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="var(--primary)" /> Jugadores Conectados ({players.length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '5px'
              }}>
                {players.map(p => (
                  <div
                    key={p.id}
                    style={{
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: p.isBot ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>
                      {p.isBot ? 'IA' : p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                        {p.name}
                      </p>
                      <p style={{ margin: '1px 0 0 0', fontSize: '0.65rem', color: p.isHost ? 'var(--primary)' : 'var(--text-muted)', fontWeight: p.isHost ? 'bold' : 'normal' }}>
                        {p.isHost ? 'Organizador' : p.isBot ? 'Bot' : 'Jugador'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(139, 92, 246, 0.04)',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              {isHost ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  {isShared 
                    ? "¡Sala compartida! Espera a tus compañeros o agrega bots de IA y presiona 'Iniciar Batalla'." 
                    : "Preguntas generadas. Haz clic en 'Compartir Sala' para notificar a tus compañeros en el chat."}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader size={16} className="spinner" color="var(--primary)" />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Esperando que el organizador inicie la competencia...
                  </p>
                </div>
              )}
            </div>

            {isHost && (
              isShared ? (
                <button
                  onClick={handleStartGame}
                  className="premium-btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  Iniciar Batalla
                </button>
              ) : (
                <button
                  onClick={handleShareLobby}
                  className="premium-btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--primary), #6d28d9)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  Compartir Sala
                </button>
              )
            )}
          </div>
        )
      )}

      {/* 3. PLAYING STATE */}
      {gameState === 'playing' && currentQ && (
        <div style={{
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
              Pregunta {currentQuestionIdx + 1} de {quizQuestions.length}
            </span>
            
            <div style={{ flex: 1, height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', margin: '0 20px', overflow: 'hidden' }}>
              <div style={{
                width: `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%`,
                height: '100%',
                background: 'var(--primary)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: timer <= 5 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              padding: '4px 10px',
              borderRadius: '8px',
              color: timer <= 5 ? '#ef4444' : '#10b981',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}>
              <Timer size={16} />
              <span>{timer}s</span>
            </div>
          </div>

          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '30px 20px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)'
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '1.25rem',
              lineHeight: '1.4',
              fontWeight: '800',
              color: 'var(--text-main)'
            }}>
              {currentQ.pregunta}
            </h1>
          </div>

          {hasAnswered && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              color: '#10b981'
            }}>
              Respuesta enviada. Esperando a los demás jugadores... ({players.filter(p => p.answered).length} / {players.length} listos)
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '15px'
          }}>
            {currentQ.opciones.map((opt, idx) => {
              const optionColors = [
                'linear-gradient(135deg, #ef4444, #dc2626)',
                'linear-gradient(135deg, #3b82f6, #2563eb)',
                'linear-gradient(135deg, #f59e0b, #d97706)',
                'linear-gradient(135deg, #10b981, #059669)'
              ];
              const symbols = ['▲', '◆', '●', '■'];
              const isSelected = myAnswerIdx === idx;

              return (
                <button
                  key={idx}
                  disabled={hasAnswered}
                  onClick={() => handleSelectOption(idx)}
                  style={{
                    background: optionColors[idx],
                    border: 'none',
                    borderRadius: '12px',
                    padding: '20px 15px',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    cursor: hasAnswered ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'left',
                    boxShadow: isSelected ? '0 0 15px rgba(255,255,255,0.4)' : 'var(--shadow-sm)',
                    opacity: hasAnswered && !isSelected ? 0.6 : 1,
                    transform: isSelected ? 'scale(1.02)' : 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onMouseOver={(e) => {
                    if (!hasAnswered) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!hasAnswered) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }
                  }}
                >
                  <span style={{
                    fontSize: '1.2rem',
                    width: '30px',
                    height: '30px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {symbols[idx]}
                  </span>
                  <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden' }}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. QUESTION RESULTS STATE */}
      {gameState === 'question_results' && currentQ && (
        <div style={{
          maxWidth: '650px',
          width: '100%',
          margin: '0 auto',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: 'var(--shadow-lg)',
          boxSizing: 'border-box'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {myAnswerIdx === -1 ? (
              <h2 style={{ margin: 0, color: '#ef4444', fontSize: '1.35rem', fontWeight: '800' }}>
                ¡Se acabó el tiempo! ⏱️
              </h2>
            ) : myAnswerIdx === currentQ.respuestaCorrecta ? (
              <h2 style={{ margin: 0, color: '#10b981', fontSize: '1.35rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CheckCircle2 size={24} /> ¡Respuesta Correcta! 🎉
              </h2>
            ) : (
              <h2 style={{ margin: 0, color: '#ef4444', fontSize: '1.35rem', fontWeight: '800' }}>
                ¡Respuesta Incorrecta! 😢
              </h2>
            )}
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {myAnswerIdx !== -1 && myAnswerIdx === currentQ.respuestaCorrecta
                ? `Ganaste +${players.find(p => p.id === user?.id)?.lastScoreChange || 0} puntos.`
                : 'Sigue intentándolo en la siguiente pregunta.'}
            </p>
          </div>

          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            padding: '15px 20px',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Respuesta Correcta:
            </span>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {currentQ.opciones[currentQ.respuestaCorrecta]}
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-main)' }}>
              Tabla de Posiciones
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedPlayers.map((p, idx) => {
                const isMe = p.id === user?.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: isMe ? 'rgba(139, 92, 246, 0.08)' : 'rgba(0,0,0,0.02)',
                      border: isMe ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '10px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '20px' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {p.name}
                      </span>
                      {p.answered && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: p.correct ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: p.correct ? '#10b981' : '#ef4444',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          {p.correct ? 'Correcto' : 'Incorrecto'}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {p.lastScoreChange > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>
                          +{p.lastScoreChange}
                        </span>
                      )}
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {p.score} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            padding: '10px',
            borderTop: '1px solid var(--border-color)'
          }}>
            La siguiente pregunta comenzará en <strong style={{ color: 'var(--primary)' }}>{timer}s</strong>...
          </div>
        </div>
      )}

      {/* 5. PODIUM STATE */}
      {gameState === 'podium' && (
        <div style={{
          maxWidth: '650px',
          width: '100%',
          margin: '0 auto',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: 'var(--shadow-lg)',
          boxSizing: 'border-box'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <span style={{ fontSize: '2rem' }}>🏆</span>
            <h2 style={{ margin: '8px 0 0 0', fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)' }}>
              Resultados del Versus
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ¡Felicitaciones a todos los participantes por poner a prueba su aprendizaje!
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '15px',
            height: '240px',
            marginBottom: '30px',
            paddingBottom: '10px',
            borderBottom: '2px solid var(--border-color)'
          }}>
            {/* 2nd place */}
            {sortedPlayers[1] && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                maxWidth: '120px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-main)', textAlign: 'center', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%', whiteSpace: 'nowrap' }}>
                  {sortedPlayers[1].name}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {sortedPlayers[1].score} pts
                </span>
                <div style={{
                  width: '100%',
                  height: '110px',
                  background: 'linear-gradient(to top, rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.1))',
                  border: '2px solid rgba(148, 163, 184, 0.5)',
                  borderBottom: 'none',
                  borderRadius: '10px 10px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'slate',
                  gap: '5px'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>🥈</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>2do</span>
                </div>
              </div>
            )}

            {/* 1st place */}
            {sortedPlayers[0] && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                maxWidth: '140px'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%', whiteSpace: 'nowrap' }}>
                  👑 {sortedPlayers[0].name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '8px' }}>
                  {sortedPlayers[0].score} pts
                </span>
                <div style={{
                  width: '100%',
                  height: '150px',
                  background: 'linear-gradient(to top, rgba(234, 179, 8, 0.4), rgba(234, 179, 8, 0.15))',
                  border: '2px solid rgba(234, 179, 8, 0.6)',
                  borderBottom: 'none',
                  borderRadius: '10px 10px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'gold',
                  gap: '5px',
                  boxShadow: '0 -4px 20px rgba(234, 179, 8, 0.25)',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: '1.75rem' }}>🥇</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>1er Lugar</span>
                </div>
              </div>
            )}

            {/* 3rd place */}
            {sortedPlayers[2] && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                maxWidth: '120px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-main)', textAlign: 'center', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%', whiteSpace: 'nowrap' }}>
                  {sortedPlayers[2].name}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {sortedPlayers[2].score} pts
                </span>
                <div style={{
                  width: '100%',
                  height: '80px',
                  background: 'linear-gradient(to top, rgba(180, 83, 9, 0.4), rgba(180, 83, 9, 0.1))',
                  border: '2px solid rgba(180, 83, 9, 0.5)',
                  borderBottom: 'none',
                  borderRadius: '10px 10px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'brown',
                  gap: '5px'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>🥉</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>3ro</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-main)' }}>
              Tabla Final
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {sortedPlayers.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '8px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    #{idx + 1} {p.name} {p.isBot && '(IA)'}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {p.score} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={resetVersusGame}
            className="premium-btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Volver al Menú Versus
          </button>
        </div>
      )}

      {/* 6. BATTLE HISTORY DETAIL MODAL */}
      {selectedHistoryBattle && createPortal(
        <div 
          onClick={() => setSelectedHistoryBattle(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-2xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button 
              onClick={() => setSelectedHistoryBattle(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '12px',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Trophy size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Detalles del Versus
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Batalla de "{selectedHistoryBattle.documentName}" • Organizada por {selectedHistoryBattle.creatorName}
                </p>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '5px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
              {/* Leaderboard */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={16} color="var(--primary)" /> Tabla de Posiciones
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedHistoryBattle.players.sort((a, b) => b.score - a.score).map((p, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div 
                        key={idx}
                        style={{
                          background: 'rgba(0,0,0,0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          {idx < 3 ? medals[idx] : `#${idx + 1}`} {p.name} {p.isBot && '(IA)'}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {p.score} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Questions review */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="var(--primary)" /> Preguntas Evaluadas ({selectedHistoryBattle.questions.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                  {selectedHistoryBattle.questions.map((q, idx) => (
                    <div 
                      key={idx}
                      style={{
                        background: 'rgba(0, 0, 0, 0.01)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '12px'
                      }}
                    >
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: '1.4' }}>
                        {idx + 1}. {q.pregunta}
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {q.opciones.map((opt, oIdx) => {
                          const isCorrect = oIdx === q.respuestaCorrecta;
                          return (
                            <div 
                              key={oIdx}
                              style={{
                                fontSize: '0.75rem',
                                color: isCorrect ? '#10b981' : 'var(--text-muted)',
                                fontWeight: isCorrect ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span>{String.fromCharCode(65 + oIdx)})</span>
                              <span>{opt}</span>
                              {isCorrect && <CheckCircle2 size={12} style={{ color: '#10b981' }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedHistoryBattle(null)}
              className="premium-btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Cerrar Vista
            </button>
          </div>
        </div>,
        document.body
      )}

      {showHistoryModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          boxSizing: 'border-box'
        }}>
          <div className="premium-modal" style={{
            maxWidth: '850px',
            width: '90%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            padding: '30px'
          }}>
            <button 
              onClick={() => setShowHistoryModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '12px',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Trophy size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Historial de Batallas del Grupo
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Resultados históricos de los Versus completados en este grupo de estudio.
                </p>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '15px 0' }} />

            <div style={{
              flex: 1,
              overflowY: 'auto',
              paddingRight: '5px',
              minHeight: 0
            }}>
              {battleHistory.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'rgba(0, 0, 0, 0.01)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--text-muted)'
                }}>
                  <Award size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>No hay batallas registradas en el historial</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', opacity: 0.8 }}>¡Completa un Versus para ver tus resultados aquí!</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '15px'
                }}>
                  {battleHistory.map((history) => {
                    const sorted = [...history.players].sort((a, b) => b.score - a.score);
                    const winner = sorted[0];
                    return (
                      <div 
                        key={history.gameId}
                        style={{
                          background: 'rgba(139, 92, 246, 0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.02)';
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                            <span style={{
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              color: 'var(--text-main)',
                              lineHeight: '1.3',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {history.documentName}
                            </span>
                          </div>
                          <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Organizador: <strong>{history.creatorName}</strong>
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Fecha: <strong>{new Date(history.timestamp).toLocaleDateString()}</strong>
                          </p>
                          {winner && (
                            <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                              🥇 Ganador: {winner.name} ({winner.score} pts)
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedHistoryBattle(history);
                            setShowHistoryModal(false);
                          }}
                          className="premium-btn-primary"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%'
                          }}
                        >
                          Ver Historial y Respuestas
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
          document.body
        )}
      </div>
    );
  }

