import { useState, useEffect, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateToolSuggestions, generateQuizFromNotes } from '../utils/aiProcessor';
import { addStudyMinutes } from '../utils/studyTracker';
import { getSafeLocalStorage } from '../utils/storageSecurity';
import { marked } from 'marked';
import { 
  Book, BookOpen, Plus, Trash2, ArrowLeft, Save, 
  Sparkles, Loader, X, Share2, ShieldCheck, PencilLine, 
  Users, Code, Database, Brain, Rocket, HelpCircle,
  Headphones, Play, Pause, Square, Download, Volume2,
  MessageSquare, Cpu, Flame, Check, AlertTriangle, RefreshCw
} from 'lucide-react';

const iconMap = {
  Share2, ShieldCheck, PencilLine, Users, Code, Database, Brain, Rocket
};

export default function Apuntes() {
  const { effectiveSchedule } = useSchedule();
  const { user } = useAuth();

  const [activeSubject, setActiveSubject] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNoteIdForTitle, setEditingNoteIdForTitle] = useState(null);
  const [tempNoteTitle, setTempNoteTitle] = useState('');
  const [ttsVolume, setTtsVolume] = useState(1.0);
  const activeUtteranceRef = useRef(null);
  
  // Selection checklist for Quiz
  const [selectedQuizNoteIds, setSelectedQuizNoteIds] = useState([]);




  // AI Quiz states
  const [quizActive, setQuizActive] = useState(false);
  const [quizStage, setQuizStage] = useState('loading'); // 'loading' | 'playing' | 'results'
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { [questionIndex]: optionIndex }
  const [quizError, setQuizError] = useState(null);
  
  // AI Recommendations modal state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [tools, setTools] = useState([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [toolsError, setToolsError] = useState(null);

  // TTS (Text-to-Speech) states
  const [showTtsPanel, setShowTtsPanel] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);

  // Extract unique subjects from the schedule
  const uniqueSubjects = effectiveSchedule 
    ? Array.from(new Set(effectiveSchedule.map(c => c.title))) 
    : [];

  // Helper to match colors exactly with the timetable blocks
  const getColorType = (title) => {
    const types = ['cultura', 'tecnologias', 'ciber', 'proy-colab', 'formulacion', 'competencias', 'procesos', 'proy-noche'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return types[Math.abs(hash) % types.length];
  };

  // Load notes when changing subject
  useEffect(() => {
    if (user && activeSubject) {
      const savedNotes = getSafeLocalStorage(`academic_${user.id}_notes_${activeSubject}`, user.id, null);
      if (savedNotes) {
        setNotes(savedNotes);
      } else {
        setNotes([]);
      }
      setSelectedNote(null);
      setSelectedQuizNoteIds([]); // Reset quiz selection
    }
  }, [activeSubject, user]);

  // Load SpeechSynthesis voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter for Spanish voices
      const spanishVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith('es'));
      setVoices(spanishVoices);
      if (spanishVoices.length > 0 && !selectedVoiceName) {
        const defaultVoice = spanishVoices.find(v => v.default) || spanishVoices[0];
        setSelectedVoiceName(defaultVoice.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceName]);

  // Stop speaking when leaving or changing note
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedNote]);

  const handlePlayTts = () => {
    if (!selectedNote || !selectedNote.content.trim()) {
      alert("No hay texto en esta nota para leer.");
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert("Tu navegador no soporta conversión de texto a voz.");
      return;
    }

    addStudyMinutes(user?.id, 3); // 3 cognitive study minutes for listening to TTS summaries

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(selectedNote.content);
    activeUtteranceRef.current = utterance;
    
    if (selectedVoiceName) {
      const activeVoice = voices.find(v => v.name === selectedVoiceName);
      if (activeVoice) utterance.voice = activeVoice;
    }

    utterance.rate = ttsSpeed;
    utterance.volume = ttsVolume;

    utterance.onstart = () => {
      if (activeUtteranceRef.current === utterance) {
        setTtsPlaying(true);
        setTtsPaused(false);
      }
    };

    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        setTtsPlaying(false);
        setTtsPaused(false);
      }
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      if (activeUtteranceRef.current === utterance) {
        setTtsPlaying(false);
        setTtsPaused(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePauseTts = () => {
    if ('speechSynthesis' in window && ttsPlaying && !ttsPaused) {
      window.speechSynthesis.pause();
      setTtsPaused(true);
    }
  };

  const handleResumeTts = () => {
    if ('speechSynthesis' in window && ttsPlaying && ttsPaused) {
      window.speechSynthesis.resume();
      setTtsPaused(false);
    }
  };

  const handleStopTts = () => {
    if ('speechSynthesis' in window) {
      activeUtteranceRef.current = null;
      window.speechSynthesis.cancel();
      setTtsPlaying(false);
      setTtsPaused(false);
    }
  };

  const handleDownloadAudio = async () => {
    if (!selectedNote || !selectedNote.content.trim()) {
      alert("La nota está vacía.");
      return;
    }

    setIsDownloadingAudio(true);

    try {
      const maxLength = 800;
      let textToDownload = selectedNote.content;
      if (textToDownload.length > maxLength) {
        textToDownload = textToDownload.substring(0, maxLength);
        alert(`La nota es muy larga. Se generará el audio para los primeros ${maxLength} caracteres.`);
      }

      const encodedText = encodeURIComponent(textToDownload);
      const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodedText}&le=es`;

      try {
        const response = await fetch(youdaoUrl);
        if (!response.ok) throw new Error("Fallo de red");
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sanitizedTitle = selectedNote.title.replace(/[^a-zA-Z0-9]/g, '_') || 'nota';
        a.download = `${sanitizedTitle}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (fetchErr) {
        console.warn("CORS block detected. Falling back to direct URL tab.", fetchErr);
        window.open(youdaoUrl, '_blank');
      }
    } catch (err) {
      console.error("Error generating audio download:", err);
      alert("No se pudo generar el archivo de audio.");
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  const saveNotes = (updatedNotes) => {
    setNotes(updatedNotes);
    if (user && activeSubject) {
      localStorage.setItem(`academic_${user.id}_notes_${activeSubject}`, JSON.stringify(updatedNotes));
    }
  };

  const handleCreateNote = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: '',
      content: '',
      updatedAt: new Date().toISOString()
    };
    const updated = [newNote, ...notes];
    saveNotes(updated);
    setSelectedNote(newNote);
    setEditingNoteIdForTitle(newNote.id);
    setTempNoteTitle('');
  };

  const handleFinishNamingNote = (id) => {
    if (!editingNoteIdForTitle) return;
    setEditingNoteIdForTitle(null);
    const trimmed = tempNoteTitle.trim();
    const finalTitle = trimmed === '' ? 'nueva nota' : trimmed;
    
    const updatedNotes = notes.map(n => {
      if (n.id === id) {
        return { ...n, title: finalTitle, updatedAt: new Date().toISOString() };
      }
      return n;
    });
    saveNotes(updatedNotes);
    
    if (selectedNote && selectedNote.id === id) {
      setSelectedNote(prev => {
        if (!prev) return null;
        return { ...prev, title: finalTitle };
      });
    }
  };

  const handleUpdateNote = (field, value) => {
    if (!selectedNote) return;
    const updatedNote = {
      ...selectedNote,
      [field]: value,
      updatedAt: new Date().toISOString()
    };
    setSelectedNote(updatedNote);

    const updatedList = notes.map(n => n.id === selectedNote.id ? updatedNote : n);
    saveNotes(updatedList);
  };

  const handleDeleteNote = (e, id) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      const updatedList = notes.filter(n => n.id !== id);
      saveNotes(updatedList);
      
      // Clean up selection states
      setSelectedQuizNoteIds(prev => prev.filter(noteId => noteId !== id));
      if (selectedNote && selectedNote.id === id) {
        setSelectedNote(null);
      }
    }
  };

  const handleToggleNoteSelection = (e, noteId) => {
    e.stopPropagation();
    setSelectedQuizNoteIds(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId) 
        : [...prev, noteId]
    );
  };

  // Generate Quiz using selected notes content
  const handleGenerateQuiz = async () => {
    if (!user || !activeSubject) return;

    let textToEvaluate = "";
    if (selectedQuizNoteIds.length > 0) {
      const selectedNotes = notes.filter(n => selectedQuizNoteIds.includes(n.id));
      textToEvaluate = selectedNotes.map(n => `Título: ${n.title}\nContenido: ${n.content}`).join("\n\n");
    } else if (selectedNote) {
      textToEvaluate = `Título: ${selectedNote.title}\nContenido: ${selectedNote.content}`;
    }

    // Sanitize checks
    const plainText = textToEvaluate.replace(/Título: .*|Contenido: /g, '').trim();
    if (!textToEvaluate.trim() || plainText === '') {
      alert("Por favor escribe algo en tus apuntes o selecciona notas con contenido para generar el Quiz.");
      return;
    }

    setQuizActive(true);
    setQuizStage('loading');
    setQuizError(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    addStudyMinutes(user?.id, 5); // 5 study minutes for generating a quiz

    try {
      const questions = await generateQuizFromNotes(textToEvaluate, activeSubject);
      if (questions && questions.length > 0) {
        setQuizQuestions(questions);
        setQuizStage('playing');
      } else {
        setQuizError("La IA no pudo estructurar preguntas basadas en estas notas.");
        setQuizStage('results');
      }
    } catch (err) {
      console.error(err);
      setQuizError("Error al conectar con la IA para generar el Quiz. Intenta de nuevo.");
      setQuizStage('results');
    }
  };

  const handleSelectOption = (optionIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
  };

  // Fetch tools specific to the active subject
  const handleOpenTools = async () => {
    if (!activeSubject || !user) return;
    setIsToolsOpen(true);
    setToolsError(null);

    const cacheKey = `academic_${user.id}_ai_tools_${activeSubject}`;
    const cached = getSafeLocalStorage(cacheKey, user.id, null);

    if (cached) {
      setTools(cached);
      return;
    }

    setIsLoadingTools(true);
    try {
      const suggestions = await generateToolSuggestions([activeSubject]);
      if (suggestions && suggestions.length > 0) {
        setTools(suggestions);
        localStorage.setItem(cacheKey, JSON.stringify(suggestions));
      } else {
        setToolsError("No se pudieron generar sugerencias para este ramo.");
      }
    } catch (err) {
      console.error(err);
      setToolsError("Error al conectar con la IA de sugerencias.");
    } finally {
      setIsLoadingTools(false);
    }
  };

  const handleFinishQuiz = () => {
    const score = quizQuestions.reduce((acc, q, i) => acc + (userAnswers[i] === q.respuestaCorrecta ? 1 : 0), 0);
    const total = quizQuestions.length;
    if (user) {
      const historyKey = `academic_${user.id}_quiz_stats`;
      const saved = getSafeLocalStorage(historyKey, user.id, null);
      const stats = saved ? saved : { count: 0, totalScore: 0, totalQuestions: 0 };
      stats.count += 1;
      stats.totalScore += score;
      stats.totalQuestions += total;
      localStorage.setItem(historyKey, JSON.stringify(stats));
      addStudyMinutes(user.id, 10); // 10 study minutes for finishing/reviewing a quiz
    }
    setQuizStage('results');
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Placeholder when no schedule is generated
  if (uniqueSubjects.length === 0) {
    return (
      <main className="main-content">
        <header>
          <div>
            <h1 className="page-title">Mis Apuntes</h1>
            <p className="subtitle">Carga tu horario para habilitar tus cuadernos de apuntes</p>
          </div>
        </header>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          textAlign: 'center',
          color: 'var(--text-muted)',
          gap: '20px'
        }}>
          <Book size={64} style={{ color: 'var(--primary)', opacity: 0.8 }} />
          <div>
            <h3>Aún no has configurado tu horario</h3>
            <p style={{ marginTop: '8px', maxWidth: '400px' }}>
              Para poder crear tus cuadernos de apuntes por asignatura, primero debes cargar o configurar tu horario.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // 2. Notebook workspace view (Active Subject)
  if (activeSubject) {
    return (
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button 
              onClick={() => setActiveSubject(null)} 
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                background: 'var(--card-bg)',
                color: 'var(--text-main)'
              }}
              title="Volver a los cuadernos"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="page-title">Cuaderno de {activeSubject}</h1>
              <p className="subtitle" style={{ color: 'var(--text-muted)' }}>Toma tus apuntes y gestiona tu material de estudio</p>
            </div>
          </div>
          
          <button 
            className="btn-primary" 
            onClick={handleOpenTools}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Sparkles size={18} /> Recomendaciones de IA
          </button>
        </header>

        <div className={`notes-workspace ${selectedNote ? 'has-selection' : ''}`}>
            {/* Notes list sidebar */}
            <aside className="notes-sidebar">
              <div className="notes-sidebar-header">
                <h3>Notas ({notes.length})</h3>
                <button 
                  onClick={handleCreateNote} 
                  className="btn-new-note"
                  title="Crear Nueva Nota"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              {/* Generate AI Quiz button */}
              {notes.length > 0 && (
                <button 
                  className="btn-generate-quiz"
                  onClick={handleGenerateQuiz}
                  title="Generar Quiz con IA"
                >
                  <HelpCircle size={16} /> Generar Quiz ({selectedQuizNoteIds.length > 0 ? `${selectedQuizNoteIds.length} notas` : 'nota activa'})
                </button>
              )}

              <div className="notes-list">
                {notes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No hay notas guardadas. ¡Crea una nueva!
                  </div>
                ) : (
                  notes.map(note => (
                    <div 
                      key={note.id} 
                      className={`note-item ${selectedNote?.id === note.id ? 'active' : ''}`}
                      onClick={() => setSelectedNote(note)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <div className="note-checkbox-container" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="note-checkbox" 
                          checked={selectedQuizNoteIds.includes(note.id)}
                          onChange={(e) => handleToggleNoteSelection(e, note.id)}
                          title="Seleccionar para Quiz"
                        />
                      </div>
                      <div className="note-item-info" style={{ flexGrow: 1, minWidth: 0 }} onClick={(e) => {
                        if (editingNoteIdForTitle === note.id) {
                          e.stopPropagation();
                        }
                      }}>
                        {editingNoteIdForTitle === note.id ? (
                          <input
                            type="text"
                            value={tempNoteTitle}
                            onChange={(e) => setTempNoteTitle(e.target.value)}
                            onBlur={() => handleFinishNamingNote(note.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            autoFocus
                            style={{
                              width: '100%',
                              background: 'rgba(255,255,255,0.08)',
                              border: '1.5px solid var(--primary)',
                              borderRadius: '8px',
                              color: 'var(--text-main)',
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              padding: '4px 8px',
                              outline: 'none'
                            }}
                            placeholder="Nombrar nota..."
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="note-item-title">{note.title || 'nueva nota'}</div>
                        )}
                        <div className="note-item-date">{formatDate(note.updatedAt)}</div>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteNote(e, note.id)} 
                        className="btn-delete-note"
                        title="Eliminar Nota"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Active Note Editor */}
            <section className="notes-details-section" style={{ flexGrow: 1, height: '100%' }}>
              {selectedNote ? (
                <div className="note-editor">
                  <div className="note-editor-header" style={{ display: 'flex', alignItems: 'center' }}>
                    <button 
                      onClick={() => setSelectedNote(null)}
                      className="btn-secondary mobile-only"
                      style={{
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        borderRadius: '50%',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: 'var(--text-main)',
                        marginRight: '10px'
                      }}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <input 
                      type="text" 
                      className="note-title-input"
                      value={selectedNote.title}
                      onChange={(e) => handleUpdateNote('title', e.target.value)}
                      placeholder="Título de la nota..."
                      style={{ flexGrow: 1 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <button
                        className={`btn-tts-trigger ${showTtsPanel ? 'active' : ''}`}
                        onClick={() => {
                          setShowTtsPanel(!showTtsPanel);
                          if (showTtsPanel) handleStopTts();
                        }}
                        title="Convertir nota a voz (Text to Speech)"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: showTtsPanel ? 'var(--primary-light)' : 'var(--card-bg)',
                          color: showTtsPanel ? 'var(--primary)' : 'var(--text-main)',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          transition: '0.2s'
                        }}
                      >
                        <Headphones size={16} /> Convertir a Voz
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <Save size={16} /> Auto-guardado
                      </div>
                    </div>
                  </div>

                  {showTtsPanel && (
                    <div className="tts-control-panel">
                      <div className="tts-controls-row">
                        <div className="tts-buttons">
                          {!ttsPlaying ? (
                            <button onClick={handlePlayTts} className="btn-audio-control play" title="Reproducir">
                              <Play size={14} fill="currentColor" /> Reproducir
                            </button>
                          ) : ttsPaused ? (
                            <button onClick={handleResumeTts} className="btn-audio-control play" title="Reanudar">
                              <Play size={14} fill="currentColor" /> Reanudar
                            </button>
                          ) : (
                            <button onClick={handlePauseTts} className="btn-audio-control pause" title="Pausar">
                              <Pause size={14} fill="currentColor" /> Pausar
                            </button>
                          )}
                          
                          {(ttsPlaying || ttsPaused) && (
                            <button onClick={handleStopTts} className="btn-audio-control stop" title="Detener">
                              <Square size={14} fill="currentColor" /> Detener
                            </button>
                          )}
                        </div>

                        <div className="tts-speed-control">
                          <label>Velocidad: <strong>{ttsSpeed.toFixed(2)}x</strong></label>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1" 
                            value={ttsSpeed}
                            onChange={(e) => {
                              setTtsSpeed(parseFloat(e.target.value));
                            }}
                            onMouseUp={() => {
                              if (ttsPlaying && !ttsPaused) {
                                setTimeout(() => handlePlayTts(), 50);
                              }
                            }}
                            onTouchEnd={() => {
                              if (ttsPlaying && !ttsPaused) {
                                setTimeout(() => handlePlayTts(), 50);
                              }
                            }}
                          />
                        </div>

                        <div className="tts-volume-control">
                          <label>Volumen: <strong>{Math.round(ttsVolume * 100)}%</strong></label>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1" 
                            value={ttsVolume}
                            onChange={(e) => {
                              setTtsVolume(parseFloat(e.target.value));
                            }}
                            onMouseUp={() => {
                              if (ttsPlaying && !ttsPaused) {
                                setTimeout(() => handlePlayTts(), 50);
                              }
                            }}
                            onTouchEnd={() => {
                              if (ttsPlaying && !ttsPaused) {
                                setTimeout(() => handlePlayTts(), 50);
                              }
                            }}
                          />
                        </div>

                        {voices.length > 0 && (
                          <div className="tts-voice-control">
                            <label>Voz:</label>
                            <select 
                              value={selectedVoiceName}
                              onChange={(e) => {
                                setSelectedVoiceName(e.target.value);
                                if (ttsPlaying && !ttsPaused) {
                                  setTimeout(() => {
                                    handlePlayTts();
                                  }, 100);
                                }
                              }}
                            >
                              {voices.map((voice, index) => (
                                <option key={index} value={voice.name}>
                                  {voice.name.replace("Microsoft ", "").replace("Google ", "")}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button 
                          className="btn-tts-download"
                          onClick={handleDownloadAudio}
                          disabled={isDownloadingAudio}
                          title="Descargar nota en MP3"
                        >
                          {isDownloadingAudio ? (
                            <>
                              <Loader size={14} className="lucide-spin" /> Procesando...
                            </>
                          ) : (
                            <>
                              <Download size={14} /> Descargar MP3
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea 
                    className="note-textarea"
                    value={selectedNote.content}
                    onChange={(e) => handleUpdateNote('content', e.target.value)}
                    placeholder="Comienza a escribir aquí tus apuntes de clase..."
                  />
                </div>
              ) : (
                <div className="note-editor-placeholder">
                  <BookOpen size={48} style={{ opacity: 0.4 }} />
                  <p>Selecciona una nota de la lista o crea una nueva para empezar a escribir.</p>
                </div>
              )}
            </section>
          </div>

        {/* AI Recommendations Modal */}
        {isToolsOpen && (
          <div className="modal-overlay" onClick={() => setIsToolsOpen(false)}>
            <div className="premium-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}><Sparkles size={22} color="var(--primary)" /> Recomendaciones para {activeSubject}</h3>
                <button 
                  onClick={() => setIsToolsOpen(false)} 
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {isLoadingTools ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '40px 0' }}>
                  <Loader size={36} className="lucide-spin" color="var(--primary)" />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>La IA está analizando {activeSubject} para sugerir herramientas...</p>
                </div>
              ) : toolsError ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  {toolsError}
                </div>
              ) : (
                <div className="tools-popup-content">
                  {tools.map((cat, idx) => {
                    const IconComponent = iconMap[cat.icono] || Brain;
                    return (
                      <div key={idx} className="tool-category-section">
                        <h4 className="tool-category-title">
                          <IconComponent size={18} color="var(--primary)" /> {cat.categoria}
                        </h4>
                        <div className="tools-list-in-modal">
                          {cat.herramientas.map((tool, tIdx) => (
                            <div key={tIdx} className="tool-item-card">
                              <strong>{tool.nombre}</strong>
                              <p>{tool.descripcion}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Study Quiz Modal */}
        {quizActive && (
          <div className="modal-overlay" onClick={() => { if (quizStage === 'results' || window.confirm('¿Deseas salir del Quiz en curso? Se perderá todo tu progreso.')) setQuizActive(false); }}>
            <div className="premium-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}><Sparkles size={22} color="var(--primary)" /> Quiz de Estudio con IA</h3>
                <button 
                  onClick={() => { if (quizStage === 'results' || window.confirm('¿Deseas salir del Quiz en curso? Se perderá todo tu progreso.')) setQuizActive(false); }} 
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {quizStage === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '40px 0' }}>
                  <Loader size={36} className="lucide-spin" color="var(--primary)" />
                  <p style={{ color: 'var(--text-main)', fontWeight: 600 }}>Generando tu evaluación interactiva con IA...</p>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', maxWidth: '400px', lineHeight: '1.4' }}>
                    Estamos analizando el contenido de tus notas para redactar preguntas de opción múltiple personalizadas.
                  </span>
                </div>
              )}

              {quizStage === 'playing' && quizQuestions.length > 0 && (
                <div className="quiz-wizard">
                  <div className="quiz-header-bar">
                    <span>Pregunta {currentQuestionIndex + 1} de {quizQuestions.length}</span>
                    <span>{Object.values(userAnswers).length} respondidas</span>
                  </div>
                  
                  <div className="quiz-progress-container">
                    <div 
                      className="quiz-progress-fill" 
                      style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
                    />
                  </div>

                  <div className="quiz-question-box">
                    <h4>{quizQuestions[currentQuestionIndex].pregunta}</h4>
                  </div>

                  <div className="quiz-options-list">
                    {quizQuestions[currentQuestionIndex].opciones.map((option, idx) => (
                      <button
                        key={idx}
                        className={`quiz-option-btn ${userAnswers[currentQuestionIndex] === idx ? 'selected' : ''}`}
                        onClick={() => handleSelectOption(idx)}
                      >
                        <span style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: userAnswers[currentQuestionIndex] === idx ? 'var(--primary)' : 'var(--border-color)',
                          color: userAnswers[currentQuestionIndex] === idx ? 'white' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.85rem'
                        }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentQuestionIndex === 0}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        opacity: currentQuestionIndex === 0 ? 0.5 : 1
                      }}
                    >
                      Anterior
                    </button>
                    
                    {currentQuestionIndex < quizQuestions.length - 1 ? (
                      <button
                        className="btn-primary"
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        disabled={userAnswers[currentQuestionIndex] === undefined}
                        style={{ padding: '10px 25px' }}
                      >
                        Siguiente
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={handleFinishQuiz}
                        disabled={userAnswers[currentQuestionIndex] === undefined}
                        style={{ padding: '10px 25px', background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }}
                      >
                        Finalizar Quiz
                      </button>
                    )}
                  </div>
                </div>
              )}

              {quizStage === 'results' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {quizError ? (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                      {quizError}
                    </div>
                  ) : (
                    <div className="quiz-results-card">
                      <div className="quiz-score-badge">
                        {quizQuestions.reduce((score, q, i) => score + (userAnswers[i] === q.respuestaCorrecta ? 1 : 0), 0)}/{quizQuestions.length}
                      </div>
                      <h3 style={{ marginTop: '10px' }}>¡Quiz Completado!</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '400px' }}>
                        {(() => {
                          const score = quizQuestions.reduce((score, q, i) => score + (userAnswers[i] === q.respuestaCorrecta ? 1 : 0), 0);
                          if (score === quizQuestions.length) return "¡Impecable! Has respondido todo de forma correcta.";
                          if (score >= 4) return "¡Excelente rendimiento! Demuestras un gran entendimiento.";
                          if (score >= 3) return "Buen trabajo. Repasa las notas para perfeccionar estos temas.";
                          return "Necesitas repasar. Te aconsejamos volver a leer tus apuntes y reintentar.";
                        })()}
                      </p>

                      <div className="quiz-review-scroll">
                        {quizQuestions.map((q, qIdx) => {
                          const isCorrect = userAnswers[qIdx] === q.respuestaCorrecta;
                          return (
                            <div key={q.id || qIdx} className="quiz-review-card">
                              <h5 style={{ marginBottom: '8px' }}>{qIdx + 1}. {q.pregunta}</h5>
                              <div className="quiz-review-options">
                                {q.opciones.map((opt, oIdx) => {
                                  let optClass = "";
                                  if (oIdx === q.respuestaCorrecta) optClass = "correct";
                                  else if (userAnswers[qIdx] === oIdx && !isCorrect) optClass = "incorrect";

                                  return (
                                    <div key={oIdx} className={`quiz-review-option ${optClass}`}>
                                      <span style={{ fontWeight: 'bold', marginRight: '5px' }}>
                                        {String.fromCharCode(65 + oIdx)}) 
                                      </span>
                                      {opt}
                                      {oIdx === q.respuestaCorrecta && " (Respuesta Correcta)"}
                                      {userAnswers[qIdx] === oIdx && !isCorrect && " (Tu Selección)"}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn-primary" 
                    onClick={() => setQuizActive(false)} 
                    style={{ width: '100%', marginTop: '15px' }}
                  >
                    Volver a Apuntes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  // 3. Grid of Notebooks view
  return (
    <main className="main-content">
      <header>
        <div>
          <h1 className="page-title">Mis Cuadernos</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)' }}>Organiza tus apuntes y recursos inteligentes por asignatura</p>
        </div>
      </header>

      <div className="notebooks-grid">
        {uniqueSubjects.map((sub, index) => {
          const colorType = getColorType(sub);
          return (
            <div 
              key={index} 
              className="notebook-card"
              onClick={() => setActiveSubject(sub)}
            >
              <div className={`notebook-card-cover ${colorType}`}>
                📖
              </div>
              <div className="notebook-card-details">
                <h3 className="notebook-card-title">{sub}</h3>
                <div className="notebook-card-meta">
                  <span>Asignatura</span>
                  <button className="btn-notebook-action">Abrir cuaderno</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
