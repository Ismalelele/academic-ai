import { useState, useEffect, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateToolSuggestions, generateQuizFromNotes, transcribeAudio, generateRecordingSummary, askTranscriptAI } from '../utils/aiProcessor';
import { marked } from 'marked';
import { 
  Book, BookOpen, Plus, Trash2, ArrowLeft, Save, 
  Sparkles, Loader, X, Share2, ShieldCheck, PencilLine, 
  Users, Code, Database, Brain, Rocket, HelpCircle,
  Headphones, Play, Pause, Square, Download, Volume2,
  Mic, FileAudio, MessageSquare, Cpu, Flame, Check, AlertTriangle, RefreshCw
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
  
  // Selection checklist for Quiz
  const [selectedQuizNoteIds, setSelectedQuizNoteIds] = useState([]);

  // Pestaña activa del workspace
  const [workspaceTab, setWorkspaceTab] = useState('notes'); // 'notes' | 'recordings'

  // Grabación de clases
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [recordingTab, setRecordingTab] = useState('summary'); // 'summary' | 'concepts' | 'quiz' | 'flashcards' | 'transcript'
  const [activeRecordingFlashcardIdx, setActiveRecordingFlashcardIdx] = useState(0);
  const [recordingFlashcardFlipped, setRecordingFlashcardFlipped] = useState(false);
  const [recordingQuizAnswers, setRecordingQuizAnswers] = useState({}); // { [questionIdx]: optionText }
  const [recordingShowQuizScore, setRecordingShowQuizScore] = useState(false);
  const [recordingChatInput, setRecordingChatInput] = useState('');
  const [recordingChatHistory, setRecordingChatHistory] = useState([]);
  const [recordingChatLoading, setRecordingChatLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    if (user && activeSubject) {
      loadRecordings();
    }
  }, [user, activeSubject]);

  const loadRecordings = async () => {
    // 1. Cargar desde localStorage
    const localSaved = localStorage.getItem(`academic_recordings_${user.id}_${activeSubject}`);
    if (localSaved) {
      setRecordings(JSON.parse(localSaved));
    } else {
      setRecordings([]);
    }

    // 2. Cargar desde Supabase si está disponible
    if (supabase && user.id && !user.id.startsWith('user-local-')) {
      try {
        const { data, error } = await supabase
          .from('clases_grabadas')
          .select('*')
          .eq('user_id', user.id)
          .eq('asignatura', activeSubject)
          .order('fecha_creacion', { ascending: false });

        if (!error && data) {
          setRecordings(data);
          localStorage.setItem(`academic_recordings_${user.id}_${activeSubject}`, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Fallo al sincronizar grabaciones desde Supabase:", err);
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const defaultTitle = `Clase - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        const title = window.prompt("Ingresa un título para esta grabación de clase:", defaultTitle) || defaultTitle;
        
        await handleSaveAndProcess(audioBlob, title);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error al iniciar grabación:", err);
      alert("No se pudo acceder al micrófono. Asegúrate de otorgar los permisos necesarios.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSaveAndProcess = async (audioBlob, title) => {
    setTranscribing(true);
    try {
      const transcriptText = await transcribeAudio(audioBlob);
      
      setAnalyzing(true);
      const aiMaterials = await generateRecordingSummary(transcriptText);
      
      const newRecording = {
        id_grabacion: `grab-${Date.now()}`,
        user_id: user?.id || 'local-user',
        asignatura: activeSubject,
        titulo: title,
        transcripcion: transcriptText,
        resumen: aiMaterials.resumen,
        conceptos_clave: aiMaterials.conceptosClave,
        preguntas_prueba: aiMaterials.preguntasPrueba,
        flashcards: aiMaterials.flashcards,
        fecha_creacion: new Date().toISOString()
      };

      if (supabase && user && user.id && !user.id.startsWith('user-local-')) {
        try {
          const { error } = await supabase.from('clases_grabadas').insert([newRecording]);
          if (error) throw error;
        } catch (dbErr) {
          console.warn("Fallo al guardar grabación en Supabase, se mantiene en localStorage:", dbErr);
        }
      }

      const updatedRecordings = [newRecording, ...recordings];
      setRecordings(updatedRecordings);
      localStorage.setItem(`academic_recordings_${user?.id || 'local'}_${activeSubject}`, JSON.stringify(updatedRecordings));
      setSelectedRecording(newRecording);
      setRecordingTab('summary');
      setRecordingChatHistory([]);
    } catch (error) {
      console.error("Error al procesar la grabación:", error);
      alert("Error al transcribir o procesar la grabación de clase: " + (error.message || error));
    } finally {
      setTranscribing(false);
      setAnalyzing(false);
    }
  };

  const handleDeleteRecording = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta grabación y todo su material de estudio?")) return;

    if (supabase && user && user.id && !user.id.startsWith('user-local-')) {
      try {
        await supabase.from('clases_grabadas').delete().eq('id_grabacion', id);
      } catch (err) {
        console.warn("No se pudo eliminar de la base de datos de Supabase:", err);
      }
    }

    const updatedRecordings = recordings.filter(rec => rec.id_grabacion !== id);
    setRecordings(updatedRecordings);
    localStorage.setItem(`academic_recordings_${user.id}_${activeSubject}`, JSON.stringify(updatedRecordings));

    if (selectedRecording?.id_grabacion === id) {
      setSelectedRecording(null);
    }
  };

  const handleSendRecordingChatMessage = async (e) => {
    e.preventDefault();
    if (!recordingChatInput.trim() || !selectedRecording) return;

    const userMessage = { sender: 'user', text: recordingChatInput };
    setRecordingChatHistory(prev => [...prev, userMessage]);
    setRecordingChatInput('');
    setRecordingChatLoading(true);

    try {
      const reply = await askTranscriptAI(selectedRecording.transcripcion, recordingChatInput);
      setRecordingChatHistory(prev => [...prev, { sender: 'ai', text: reply }]);
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      setRecordingChatHistory(prev => [...prev, { sender: 'ai', text: "❌ Error: Ocurrió un fallo al comunicarse con la IA." }]);
    } finally {
      setRecordingChatLoading(false);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderRecordingsWorkspace = () => {
    return (
      <div className="notes-workspace" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px', height: '100%', overflow: 'hidden' }}>
        <aside className="notes-sidebar">
          <div className="notes-sidebar-header" style={{ marginBottom: '15px' }}>
            <h3>Grabaciones ({recordings.length})</h3>
          </div>

          <div className="recording-control-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '15px', textAlign: 'center' }}>
            {isRecording ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div className="recording-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="live-dot" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }}></span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Grabando...</span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'monospace' }}>
                  {formatTimer(recordingTime)}
                </div>
                <button className="btn-primary" onClick={stopRecording} style={{ background: '#ef4444', display: 'flex', gap: '8px', padding: '10px 15px', borderRadius: '8px' }}>
                  <Square size={16} /> Detener Grabación
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Graba tu clase presencial o virtual para transcribirla con IA</p>
                <button className="btn-primary" onClick={startRecording} style={{ display: 'flex', gap: '8px', padding: '10px 20px', borderRadius: '8px', width: '100%' }}>
                  <Mic size={16} /> Iniciar Grabación
                </button>
              </div>
            )}
          </div>

          <div className="notes-list" style={{ overflowY: 'auto', flex: 1 }}>
            {recordings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No tienes grabaciones de clase.
              </div>
            ) : (
              recordings.map(rec => (
                <div 
                  key={rec.id_grabacion} 
                  className={`note-item ${selectedRecording?.id_grabacion === rec.id_grabacion ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedRecording(rec);
                    setRecordingTab('summary');
                    setRecordingChatHistory([]);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <FileAudio size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                      {rec.titulo}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(rec.fecha_creacion).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteRecording(e, rec.id_grabacion)} 
                    className="btn-delete-note"
                    style={{ opacity: 0.6, cursor: 'pointer', border: 'none', background: 'transparent' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section style={{ flexGrow: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {transcribing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifycontent: 'center', flex: 1, color: 'var(--text-muted)', gap: '15px' }}>
              <Loader size={48} className="spinner" style={{ color: 'var(--primary)' }} />
              <div style={{ textAlign: 'center' }}>
                <h3>{analyzing ? 'Generando materiales de estudio con IA...' : 'Transcribiendo audio de la clase...'}</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                  {analyzing 
                    ? 'Groq está construyendo el resumen, conceptos clave, cuestionarios y flashcards...' 
                    : 'Groq Whisper está procesando el archivo de voz para generar el texto completo...'}
                </p>
              </div>
            </div>
          ) : selectedRecording ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{selectedRecording.titulo}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Clase grabada el {new Date(selectedRecording.fecha_creacion).toLocaleString()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '5px', padding: '10px 20px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', flexShrink: 0, overflowX: 'auto' }}>
                {[
                  { id: 'summary', label: 'Resumen', icon: BookOpen },
                  { id: 'concepts', label: 'Conceptos Clave', icon: Brain },
                  { id: 'quiz', label: 'Autoevaluación', icon: HelpCircle },
                  { id: 'flashcards', label: 'Fichas (Flashcards)', icon: Sparkles },
                  { id: 'transcript', label: 'Transcripción', icon: FileAudio }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setRecordingTab(tab.id);
                      if (tab.id === 'flashcards') {
                        setActiveRecordingFlashcardIdx(0);
                        setRecordingFlashcardFlipped(false);
                      }
                      if (tab.id === 'quiz') {
                        setRecordingQuizAnswers({});
                        setRecordingShowQuizScore(false);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      background: recordingTab === tab.id ? 'var(--primary-light)' : 'transparent',
                      color: recordingTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                      transition: '0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <tab.icon size={14} /> {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', minHeight: 0 }}>
                {recordingTab === 'summary' && (
                  <div style={{ lineHeight: '1.6' }} className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(selectedRecording.resumen || '') }}></div>
                )}

                {recordingTab === 'concepts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h4 style={{ margin: 0 }}>Conceptos Clave de la Sesión</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {selectedRecording.conceptos_clave && selectedRecording.conceptos_clave.map((concept, idx) => (
                        <div key={idx} style={{ padding: '10px 15px', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: '8px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          🔑 {concept}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recordingTab === 'transcript' && (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '0.9rem', color: 'var(--text-main)', background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    {selectedRecording.transcripcion}
                  </div>
                )}

                {recordingTab === 'quiz' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>Cuestionario de Comprensión IA</h4>
                      {recordingShowQuizScore && (
                        <span style={{ fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.85rem' }}>
                          Puntaje: {
                            Object.keys(recordingQuizAnswers).filter(idx => {
                              const q = selectedRecording.preguntas_prueba[idx];
                              return q && q.opciones[recordingQuizAnswers[idx]] === q.respuestaCorrecta;
                            }).length
                          } / {selectedRecording.preguntas_prueba.length}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                      {selectedRecording.preguntas_prueba && selectedRecording.preguntas_prueba.map((q, qIdx) => {
                        const isCorrect = q.opciones[recordingQuizAnswers[qIdx]] === q.respuestaCorrecta;
                        return (
                          <div key={qIdx} style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'left' }}>
                            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{qIdx + 1}. {q.pregunta}</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {q.opciones.map((opt, oIdx) => {
                                const isSelected = recordingQuizAnswers[qIdx] === oIdx;
                                let optBg = 'transparent';
                                let optBorder = 'var(--border-color)';
                                if (isSelected) {
                                  optBg = 'var(--primary-light)';
                                  optBorder = 'var(--primary)';
                                }
                                if (recordingShowQuizScore) {
                                  if (opt === q.respuestaCorrecta) {
                                    optBg = 'rgba(34, 197, 94, 0.1)';
                                    optBorder = '#22c55e';
                                  } else if (isSelected && !isCorrect) {
                                    optBg = 'rgba(239, 68, 68, 0.1)';
                                    optBorder = '#ef4444';
                                  }
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    disabled={recordingShowQuizScore}
                                    onClick={() => {
                                      setRecordingQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
                                    }}
                                    style={{
                                      padding: '10px 15px',
                                      borderRadius: '8px',
                                      border: `1.5px solid ${optBorder}`,
                                      background: optBg,
                                      color: 'var(--text-main)',
                                      textAlign: 'left',
                                      fontSize: '0.82rem',
                                      fontWeight: isSelected ? '700' : '500',
                                      cursor: recordingShowQuizScore ? 'default' : 'pointer',
                                      transition: '0.15s'
                                    }}
                                  >
                                    <span style={{ marginRight: '6px', fontWeight: 'bold' }}>{String.fromCharCode(65 + oIdx)}</span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {recordingShowQuizScore && (
                              <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', borderLeft: '3px solid var(--primary)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                💡 <strong>Explicación:</strong> {q.explicacion}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!recordingShowQuizScore && (
                      <button
                        className="btn-primary"
                        disabled={Object.keys(recordingQuizAnswers).length !== selectedRecording.preguntas_prueba.length}
                        onClick={() => setRecordingShowQuizScore(true)}
                        style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: '8px' }}
                      >
                        Enviar Respuestas
                      </button>
                    )}
                  </div>
                )}

                {recordingTab === 'flashcards' && selectedRecording.flashcards && selectedRecording.flashcards.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px 0' }}>
                    <h4 style={{ margin: 0 }}>Tarjetas de Estudio Interactivas (Repaso Activo)</h4>
                    
                    <div 
                      onClick={() => setRecordingFlashcardFlipped(!recordingFlashcardFlipped)}
                      style={{
                        width: '400px',
                        height: '240px',
                        perspective: '1000px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: recordingFlashcardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                      }}>
                        <div style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          backfaceVisibility: 'hidden',
                          background: 'var(--card-bg)',
                          border: '2px solid var(--border-color)',
                          borderRadius: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '24px',
                          boxShadow: 'var(--shadow-md)',
                          textAlign: 'center',
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px' }}>Frente</span>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '700', lineHeight: '1.4' }}>
                            {selectedRecording.flashcards[activeRecordingFlashcardIdx].front}
                          </h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '20px' }}>Hacer clic para voltear</span>
                        </div>

                        <div style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          backfaceVisibility: 'hidden',
                          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.05), rgba(139, 92, 246, 0.05))',
                          border: '2px solid var(--primary)',
                          borderRadius: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '24px',
                          boxShadow: 'var(--shadow-md)',
                          textAlign: 'center',
                          transform: 'rotateY(180deg)',
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px' }}>Reverso</span>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                            {selectedRecording.flashcards[activeRecordingFlashcardIdx].back}
                          </p>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '20px' }}>Hacer clic para voltear</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
                      <button
                        className="btn-secondary"
                        disabled={activeRecordingFlashcardIdx === 0}
                        onClick={() => {
                          setActiveRecordingFlashcardIdx(prev => prev - 1);
                          setRecordingFlashcardFlipped(false);
                        }}
                        style={{ padding: '8px 16px', borderRadius: '8px' }}
                      >
                        Anterior
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                        {activeRecordingFlashcardIdx + 1} / {selectedRecording.flashcards.length}
                      </span>
                      <button
                        className="btn-secondary"
                        disabled={activeRecordingFlashcardIdx === selectedRecording.flashcards.length - 1}
                        onClick={() => {
                          setActiveRecordingFlashcardIdx(prev => prev + 1);
                          setRecordingFlashcardFlipped(false);
                        }}
                        style={{ padding: '8px 16px', borderRadius: '8px' }}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '15px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  <MessageSquare size={14} /> Asistente de Grabación RAG
                </div>
                
                {recordingChatHistory.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '120px', overflowY: 'auto', padding: '5px', background: 'rgba(0,0,0,0.01)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {recordingChatHistory.map((msg, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          maxWidth: '85%',
                          background: msg.sender === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                          color: msg.sender === 'user' ? 'white' : 'var(--text-main)',
                          border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)'
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {recordingChatLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                        <Loader size={12} className="spinner" /> Asistente pensando...
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleSendRecordingChatMessage} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Pregúntale a la IA sobre el contenido de esta clase..."
                    value={recordingChatInput}
                    onChange={(e) => setRecordingChatInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 15px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={!recordingChatInput.trim() || recordingChatLoading} 
                    style={{ padding: '10px 15px', borderRadius: '8px' }}
                  >
                    Preguntar
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="note-editor-placeholder">
              <FileAudio size={48} style={{ opacity: 0.4 }} />
              <p>Selecciona una clase grabada de la lista o graba una nueva clase para transcribirla con IA.</p>
            </div>
          )}
        </section>
      </div>
    );
  };


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
      const savedNotes = localStorage.getItem(`academic_notes_${user.id}_${activeSubject}`);
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
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

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(selectedNote.content);
    
    if (selectedVoiceName) {
      const activeVoice = voices.find(v => v.name === selectedVoiceName);
      if (activeVoice) utterance.voice = activeVoice;
    }

    utterance.rate = ttsSpeed;

    utterance.onstart = () => {
      setTtsPlaying(true);
      setTtsPaused(false);
    };

    utterance.onend = () => {
      setTtsPlaying(false);
      setTtsPaused(false);
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setTtsPlaying(false);
      setTtsPaused(false);
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
      localStorage.setItem(`academic_notes_${user.id}_${activeSubject}`, JSON.stringify(updatedNotes));
    }
  };

  const handleCreateNote = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: 'Nueva Nota',
      content: '',
      updatedAt: new Date().toISOString()
    };
    const updated = [newNote, ...notes];
    saveNotes(updated);
    setSelectedNote(newNote);
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

    const cacheKey = `ai_tools_${user.id}_${activeSubject}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      setTools(JSON.parse(cached));
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
      const historyKey = `quiz_stats_${user.id}`;
      const saved = localStorage.getItem(historyKey);
      const stats = saved ? JSON.parse(saved) : { count: 0, totalScore: 0, totalQuestions: 0 };
      stats.count += 1;
      stats.totalScore += score;
      stats.totalQuestions += total;
      localStorage.setItem(historyKey, JSON.stringify(stats));
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

        {/* Segmented control for switching workspaces */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '25px',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          width: 'fit-content'
        }}>
          <button
            onClick={() => setWorkspaceTab('notes')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: workspaceTab === 'notes' ? 'var(--primary)' : 'transparent',
              color: workspaceTab === 'notes' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <BookOpen size={16} /> Notas del Cuaderno
          </button>
          <button
            onClick={() => setWorkspaceTab('recordings')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: workspaceTab === 'recordings' ? 'var(--primary)' : 'transparent',
              color: workspaceTab === 'recordings' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Mic size={16} /> Clases Grabadas (IA)
          </button>
        </div>

        {workspaceTab === 'notes' ? (
          <div className="notes-workspace">
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
                      <div className="note-item-info" style={{ flexGrow: 1, minWidth: 0 }}>
                        <div className="note-item-title">{note.title || 'Nueva Nota'}</div>
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
            <section style={{ flexGrow: 1, height: '100%' }}>
              {selectedNote ? (
                <div className="note-editor">
                  <div className="note-editor-header">
                    <input 
                      type="text" 
                      className="note-title-input"
                      value={selectedNote.title}
                      onChange={(e) => handleUpdateNote('title', e.target.value)}
                      placeholder="Título de la nota..."
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
                              const newSpeed = parseFloat(e.target.value);
                              setTtsSpeed(newSpeed);
                              if (ttsPlaying && !ttsPaused) {
                                setTimeout(() => {
                                  handlePlayTts();
                                }, 100);
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
        ) : (
          renderRecordingsWorkspace()
        )}

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
