import { useState, useEffect, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { transcribeAudio, generateRecordingSummary, askTranscriptAI } from '../utils/aiProcessor';
import { marked } from 'marked';
import ysFixWebmDuration from 'fix-webm-duration';
import { 
  Book, ArrowLeft, Loader, Trash2, Mic, FileAudio, MessageSquare, 
  BookOpen, Brain, HelpCircle, Sparkles, Square, Play, Pause, Headphones
} from 'lucide-react';

// Helper functions for storing audio files in IndexedDB
const openAudioDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AcademicAudioDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios', { keyPath: 'id_grabacion' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const saveAudioBlob = async (id, blob) => {
  try {
    const db = await openAudioDB();
    const transaction = db.transaction('audios', 'readwrite');
    const store = transaction.objectStore('audios');
    store.put({ id_grabacion: id, blob });
  } catch (err) {
    console.error("Error al guardar audio en IndexedDB:", err);
  }
};

const getAudioBlob = async (id) => {
  try {
    const db = await openAudioDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('audios', 'readonly');
      const store = transaction.objectStore('audios');
      const request = store.get(id);
      request.onsuccess = (e) => {
        resolve(e.target.result ? e.target.result.blob : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error("Error al leer audio desde IndexedDB:", err);
    return null;
  }
};

const deleteAudioBlob = async (id) => {
  try {
    const db = await openAudioDB();
    const transaction = db.transaction('audios', 'readwrite');
    const store = transaction.objectStore('audios');
    store.delete(id);
  } catch (err) {
    console.error("Error al eliminar audio de IndexedDB:", err);
  }
};

export default function ClasesGrabadas() {
  const { effectiveSchedule } = useSchedule();
  const { user } = useAuth();
  const [audioSrc, setAudioSrc] = useState(null);
  const [activeSubject, setActiveSubject] = useState(null);

  const [customSubjects, setCustomSubjects] = useState(() => {
    const saved = localStorage.getItem(`academic_custom_subjects_${user?.id || 'local'}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`academic_custom_subjects_${user.id}`);
      if (saved) {
        setCustomSubjects(JSON.parse(saved));
      }
    }
  }, [user]);

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
  const recordingStartTimeRef = useRef(null);
  const activeObjectUrlRef = useRef(null);

  useEffect(() => {
    if (user && activeSubject) {
      loadRecordings();
    }
  }, [user, activeSubject]);

  useEffect(() => {
    let active = true;

    // Revoke previous URL if any to prevent leaks
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }

    if (selectedRecording) {
      getAudioBlob(selectedRecording.id_grabacion).then(blob => {
        if (!active) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          activeObjectUrlRef.current = url;
          setAudioSrc(url);
        } else {
          setAudioSrc(null);
        }
      });
    } else {
      setAudioSrc(null);
    }

    return () => {
      active = false;
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }
    };
  }, [selectedRecording]);

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
        const duration = Date.now() - recordingStartTimeRef.current;
        const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Use ysFixWebmDuration to reconstruct headers client-side
          const fixedBlob = await ysFixWebmDuration(rawBlob, duration);
          const defaultTitle = `Clase - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          const title = window.prompt("Ingresa un título para esta grabación de clase:", defaultTitle) || defaultTitle;
          await handleSaveAndProcess(fixedBlob, title);
        } catch (fixErr) {
          console.error("Error fixing WebM duration:", fixErr);
          // Fallback to raw blob if something fails
          const defaultTitle = `Clase - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          const title = window.prompt("Ingresa un título para esta grabación de clase:", defaultTitle) || defaultTitle;
          await handleSaveAndProcess(rawBlob, title);
        }
      };

      recordingStartTimeRef.current = Date.now();
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

      await saveAudioBlob(newRecording.id_grabacion, audioBlob);

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

    await deleteAudioBlob(id);

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

  const uniqueSubjects = Array.from(new Set([
    ...(effectiveSchedule ? effectiveSchedule.map(c => c.title) : []),
    ...customSubjects,
    ...(((!effectiveSchedule || effectiveSchedule.length === 0) && customSubjects.length === 0) ? ["General"] : [])
  ]));

  const handleAddCustomSubject = () => {
    const name = window.prompt("Ingresa el nombre del nuevo cuaderno / asignatura:");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (uniqueSubjects.includes(trimmed)) {
      alert("Ya existe un cuaderno con ese nombre.");
      return;
    }
    const updated = [...customSubjects, trimmed];
    setCustomSubjects(updated);
    localStorage.setItem(`academic_custom_subjects_${user?.id || 'local'}`, JSON.stringify(updated));
  };

  const getColorType = (title) => {
    const types = ['cultura', 'tecnologias', 'ciber', 'proy-colab', 'formulacion', 'competencias', 'procesos', 'proy-noche'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return types[Math.abs(hash) % types.length];
  };

  // 2. Recordings Workspace view (Active Subject)
  if (activeSubject) {
    return (
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button 
              onClick={() => {
                setActiveSubject(null);
                setSelectedRecording(null);
              }} 
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
              title="Volver a las asignaturas"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>Grabaciones de {activeSubject}</h1>
              <p className="subtitle" style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Graba, transcribe y analiza tus clases presenciales o virtuales con IA</p>
            </div>
          </div>
        </header>

        <div className="notes-workspace" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <aside className="notes-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div className="notes-sidebar-header" style={{ marginBottom: '15px', flexShrink: 0 }}>
              <h3>Grabaciones ({recordings.length})</h3>
            </div>

            <div className="recording-control-panel" style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '15px', textAlign: 'center', flexShrink: 0 }}>
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

            <div className="notes-list" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {recordings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No tienes grabaciones de clase en esta asignatura.
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

          <section style={{ flexGrow: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            {transcribing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: '15px' }}>
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

                {/* Reproductor de Audio Banner */}
                {audioSrc && (
                  <div style={{
                    padding: '12px 20px',
                    background: 'rgba(139, 92, 246, 0.04)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '15px',
                    flexShrink: 0
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      background: 'var(--card-bg)',
                      border: '1.5px solid var(--primary)',
                      borderRadius: '40px',
                      padding: '8px 24px',
                      width: '100%',
                      maxWidth: '650px',
                      boxShadow: '0 8px 24px rgba(139, 92, 246, 0.12)',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', flexShrink: 0 }}>
                        <Headphones size={20} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reproductor</span>
                      </div>
                      <audio 
                        controls 
                        src={audioSrc} 
                        style={{ 
                          height: '46px', 
                          outline: 'none',
                          flexGrow: 1,
                          width: '100%'
                        }} 
                      />
                    </div>
                  </div>
                )}

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
      </main>
    );
  }

  // 3. Grid of Notebooks view (mis cuadernos)
  return (
    <main className="main-content">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title">Clases Grabadas</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)' }}>Transcribe y analiza tus apuntes y grabaciones por asignatura</p>
        </div>
        <button 
          onClick={handleAddCustomSubject}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px' }}
        >
          <Book size={16} /> Agregar Cuaderno
        </button>
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
                🎙️
              </div>
              <div className="notebook-card-details">
                <h3 className="notebook-card-title">{sub}</h3>
                <div className="notebook-card-meta">
                  <span>Asignatura</span>
                  <button className="btn-notebook-action">Ver Clases</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
