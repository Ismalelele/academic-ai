import { useState, useRef } from 'react';
import { 
  FileText, UploadCloud, Loader, CheckCircle2, AlertTriangle, 
  HelpCircle, Sparkles, BookOpen, ChevronRight, Copy, Check, Play 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { extractTextFromPptx } from '../utils/pptxParser';
import { 
  analyzeUploadedDocument, 
  generateDocumentSummary, 
  generateQuizFromText 
} from '../utils/aiProcessor';

// Configurar Worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function Analisis() {
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingState, setLoadingState] = useState(''); // '', 'reading', 'analyzing', 'summary', 'quiz'
  const [extractedText, setExtractedText] = useState('');
  
  // Results
  const [analysisResult, setAnalysisResult] = useState(null); // { score, criticalAnalysis, improvementAreas }
  const [summaryResult, setSummaryResult] = useState('');
  const [summaryType, setSummaryType] = useState(''); // 'short' or 'complete'
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizActive, setQuizActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) processFile(selectedFile);
  };

  // Extraer texto según la extensión
  const processFile = async (selectedFile) => {
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'docx', 'pptx', 'txt'];
    if (!allowed.includes(ext)) {
      alert("Formato no soportado. Sube archivos PDF, Word, PowerPoint o de Texto.");
      return;
    }

    setFile(selectedFile);
    setAnalysisResult(null);
    setSummaryResult('');
    setSummaryType('');
    setQuizQuestions([]);
    setQuizActive(false);
    setShowQuizResults(false);
    setLoadingState('reading');

    try {
      let text = '';
      if (ext === 'pdf') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map(item => item.str).join(' ') + '\n';
        }
      } else if (ext === 'docx') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === 'pptx') {
        text = await extractTextFromPptx(selectedFile);
      } else if (ext === 'txt') {
        text = await selectedFile.text();
      }

      const cleanText = text.trim();
      if (!cleanText) {
        throw new Error("El documento no contiene texto legible o está vacío.");
      }

      setExtractedText(cleanText);
      
      // Pasar a la fase de análisis con IA
      setLoadingState('analyzing');
      const analysis = await analyzeUploadedDocument(cleanText);
      setAnalysisResult(analysis);
      
      // Scroll automático a los resultados
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);

    } catch (err) {
      console.error(err);
      alert(err.message || "Error al procesar el archivo.");
      setFile(null);
    } finally {
      setLoadingState('');
    }
  };

  // Solicitar Resumen
  const handleRequestSummary = async (type) => {
    if (!extractedText) return;
    setLoadingState('summary');
    setSummaryType(type);
    setSummaryResult('');
    setQuizActive(false);

    try {
      const summary = await generateDocumentSummary(extractedText, type);
      setSummaryResult(summary);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err) {
      alert("Error al generar el resumen.");
    } finally {
      setLoadingState('');
    }
  };

  // Solicitar Quiz
  const handleRequestQuiz = async () => {
    if (!extractedText) return;
    setLoadingState('quiz');
    setSummaryResult('');
    setSummaryType('');
    setQuizQuestions([]);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setShowQuizResults(false);

    try {
      const quiz = await generateQuizFromText(extractedText);
      if (quiz && quiz.length > 0) {
        setQuizQuestions(quiz);
        setQuizActive(true);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      } else {
        alert("No se pudieron estructurar preguntas sobre el texto.");
      }
    } catch (err) {
      alert("Error al generar el quiz.");
    } finally {
      setLoadingState('');
    }
  };

  const copySummaryText = () => {
    navigator.clipboard.writeText(summaryResult);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Quiz wizard handlers
  const handleSelectOption = (optionIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
  };

  const handleFinishQuiz = () => {
    setShowQuizResults(true);
  };

  // Medidor circular de Nota
  const renderScoreCircle = (score) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    // La escala va del 1 al 10, por ende mapeamos (score / 10)
    const strokeDashoffset = circumference - (score / 10) * circumference;

    let strokeColor = '#ef4444'; // Rojo < 5
    if (score >= 7) strokeColor = '#10b981'; // Verde >= 7
    else if (score >= 5) strokeColor = '#f59e0b'; // Amarillo 5-6

    return (
      <div className="analysis-score-container">
        <svg width="120" height="120" viewBox="0 0 120 120" className="score-svg">
          <circle 
            cx="60" cy="60" r={radius} 
            stroke="var(--border-color)" strokeWidth="8" fill="transparent" 
          />
          <circle 
            cx="60" cy="60" r={radius} 
            stroke={strokeColor} strokeWidth="8" fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="analysis-score-number" style={{ color: strokeColor }}>
          {score}<span>/10</span>
        </div>
      </div>
    );
  };

  return (
    <main className="main-content">
      <header>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={32} color="var(--primary)" /> Análisis Crítico de Documentos
        </h1>
        <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
          Sube tus archivos de estudio (PDF, Word, PPTX o Texto) para obtener una evaluación inmediata, resúmenes estructurados y quizzes de estudio interactivos.
        </p>
      </header>

      {/* ÁREA DE CARGA DE ARCHIVO */}
      <section className="analysis-upload-section">
        <div 
          className={`analysis-dropzone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".pdf,.docx,.pptx,.txt"
            style={{ display: 'none' }}
          />
          
          <UploadCloud size={48} className="upload-icon" />
          
          {file ? (
            <div className="file-upload-details">
              <h4>{file.name}</h4>
              <p>{(file.size / 1024 / 1024).toFixed(2)} MB • Haz clic para cambiar de archivo</p>
            </div>
          ) : (
            <div>
              <h3>Arrastra y suelta tu documento aquí</h3>
              <p>Soporta formatos PDF, Word (.docx), PowerPoint (.pptx) y Texto (.txt)</p>
            </div>
          )}
        </div>
      </section>

      {/* ESTADO DE ESPERA / CARGANDO */}
      {loadingState !== '' && (
        <section className="analysis-loading-box">
          <Loader size={36} className="lucide-spin" color="var(--primary)" />
          {loadingState === 'reading' && <p>Extrayendo texto del documento...</p>}
          {loadingState === 'analyzing' && <p>La IA está evaluando críticamente el contenido...</p>}
          {loadingState === 'summary' && <p>Redactando el resumen solicitado con IA...</p>}
          {loadingState === 'quiz' && <p>Generando quiz interactivo basado en el documento...</p>}
        </section>
      )}

      {/* RESULTADO DEL ANÁLISIS */}
      {analysisResult && (
        <section className="analysis-results-wrapper" ref={resultsRef}>
          <div className="analysis-main-grid">
            
            {/* Tarjeta de Calificación y Áreas de Mejora */}
            <div className="analysis-score-card">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h4>Calificación General</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Evaluado por el Planificador de IA</span>
              </div>
              {renderScoreCircle(analysisResult.score)}
              
              <div className="analysis-improvement-box">
                <h4><AlertTriangle size={16} /> Áreas de Mejora</h4>
                <ul>
                  {analysisResult.improvementAreas.map((area, index) => (
                    <li key={index}>{area}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Párrafo de Análisis Crítico */}
            <div className="analysis-critique-card">
              <h3>Análisis Crítico Cualitativo</h3>
              <div 
                className="markdown-body critique-content"
                dangerouslySetInnerHTML={{ __html: marked.parse(analysisResult.criticalAnalysis || '') }}
              />
            </div>
          </div>

          {/* BARRA DE ACCIONES SECUNDARIAS */}
          <div className="analysis-actions-bar">
            <h3>¿Cómo quieres estudiar este documento?</h3>
            <div className="analysis-action-buttons">
              <button 
                className={`btn-action-study ${summaryType === 'short' ? 'active' : ''}`}
                onClick={() => handleRequestSummary('short')}
              >
                <FileText size={16} /> Resumen Corto
              </button>
              <button 
                className={`btn-action-study ${summaryType === 'complete' ? 'active' : ''}`}
                onClick={() => handleRequestSummary('complete')}
              >
                <BookOpen size={16} /> Resumen Completo
              </button>
              <button 
                className={`btn-action-study ${quizActive ? 'active' : ''}`}
                onClick={handleRequestQuiz}
              >
                <HelpCircle size={16} /> Quiz del Documento
              </button>
            </div>
          </div>

          {/* CONTENEDOR DE RESULTADOS DE ESTUDIO (RESUMEN / QUIZ) */}
          {(summaryResult || quizActive) && (
            <div className="study-results-container">
              
              {/* Resultados de Resumen */}
              {summaryResult && (
                <div className="summary-result-box">
                  <div className="summary-result-header">
                    <h4>{summaryType === 'short' ? 'Resumen Ejecutivo Corto' : 'Resumen Estructurado Completo'}</h4>
                    <button className="btn-copy-summary" onClick={copySummaryText}>
                      {copiedSummary ? (
                        <>
                          <Check size={16} color="#10b981" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={16} /> Copiar Resumen
                        </>
                      )}
                    </button>
                  </div>
                  <div 
                    className="markdown-body" 
                    dangerouslySetInnerHTML={{ __html: marked.parse(summaryResult) }}
                  />
                </div>
              )}

              {/* Resultados de Quiz */}
              {quizActive && quizQuestions.length > 0 && (
                <div className="quiz-result-box">
                  {!showQuizResults ? (
                    /* Juego en curso */
                    <div className="quiz-wizard-analysis">
                      <div className="quiz-wizard-header">
                        <h4>Pregunta {currentQuestionIndex + 1} de {quizQuestions.length}</h4>
                        <span className="quiz-badge">{Object.keys(userAnswers).length} respondidas</span>
                      </div>
                      
                      <div className="quiz-progress-bar">
                        <div 
                          className="quiz-progress-fill" 
                          style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
                        />
                      </div>

                      <div className="quiz-question-box">
                        <h3>{quizQuestions[currentQuestionIndex].pregunta}</h3>
                      </div>

                      <div className="quiz-options-list">
                        {quizQuestions[currentQuestionIndex].opciones.map((option, idx) => (
                          <button
                            key={idx}
                            className={`quiz-option-btn ${userAnswers[currentQuestionIndex] === idx ? 'selected' : ''}`}
                            onClick={() => handleSelectOption(idx)}
                          >
                            <span className="option-letter">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            {option}
                          </button>
                        ))}
                      </div>

                      <div className="quiz-wizard-actions">
                        <button
                          className="btn-secondary"
                          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                          disabled={currentQuestionIndex === 0}
                          style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1 }}
                        >
                          Anterior
                        </button>
                        
                        {currentQuestionIndex < quizQuestions.length - 1 ? (
                          <button
                            className="btn-primary"
                            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                            disabled={userAnswers[currentQuestionIndex] === undefined}
                          >
                            Siguiente
                          </button>
                        ) : (
                          <button
                            className="btn-primary highlight"
                            onClick={handleFinishQuiz}
                            disabled={userAnswers[currentQuestionIndex] === undefined}
                          >
                            Ver Resultados
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Resultados del Quiz */
                    <div className="quiz-results-analysis">
                      <div className="quiz-score-badge">
                        {quizQuestions.reduce((score, q, i) => score + (userAnswers[i] === q.respuestaCorrecta ? 1 : 0), 0)}/{quizQuestions.length}
                      </div>
                      <h3>¡Quiz del Documento Completado!</h3>
                      <p className="quiz-verdict">
                        {(() => {
                          const score = quizQuestions.reduce((score, q, i) => score + (userAnswers[i] === q.respuestaCorrecta ? 1 : 0), 0);
                          if (score === quizQuestions.length) return "¡Perfecto! Demuestras un dominio total sobre la lectura.";
                          if (score >= 4) return "¡Excelente! Has comprendido la gran mayoría del documento.";
                          if (score >= 3) return "Buen puntaje. Revisa los detalles del documento para pulir conceptos.";
                          return "Se aconseja volver a leer el documento y realizar el quiz nuevamente.";
                        })()}
                      </p>

                      <div className="quiz-review-scroll">
                        {quizQuestions.map((q, qIdx) => {
                          const isCorrect = userAnswers[qIdx] === q.respuestaCorrecta;
                          return (
                            <div key={qIdx} className="quiz-review-card">
                              <h5>{qIdx + 1}. {q.pregunta}</h5>
                              <div className="quiz-review-options">
                                {q.opciones.map((opt, oIdx) => {
                                  let optClass = "";
                                  if (oIdx === q.respuestaCorrecta) optClass = "correct";
                                  else if (userAnswers[qIdx] === oIdx && !isCorrect) optClass = "incorrect";

                                  return (
                                    <div key={oIdx} className={`quiz-review-option ${optClass}`}>
                                      <span className="bullet-letter">{String.fromCharCode(65 + oIdx)})</span>
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

                      <button className="btn-primary" onClick={() => { setQuizActive(false); setShowQuizResults(false); }}>
                        Cerrar Evaluación
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </section>
      )}
    </main>
  );
}
