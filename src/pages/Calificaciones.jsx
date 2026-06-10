import { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { marked } from 'marked';
import { 
  GraduationCap, Plus, Trash2, Info, X, HelpCircle, 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, Loader, Play
} from 'lucide-react';
import { getAcademicRiskAnalysis } from '../utils/aiProcessor';

const parseGrade = (val) => {
  if (!val) return 0;
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  if (num >= 10 && num <= 70) {
    return num / 10;
  }
  if (num >= 1 && num <= 7) {
    return num;
  }
  return num / 10;
};

const formatNote = (val) => {
  if (val === '') return '';
  if (val === '0') return '0';
  
  let cleaned = val.replace(/[^0-9]/g, '');
  while (cleaned.length > 2 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length > 2) {
    cleaned = cleaned.substring(0, 2);
  }
  if (cleaned === '0') {
    return '0';
  }
  while (cleaned.length < 2) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
};

const formatWeight = (val) => {
  if (val === '') return '';
  if (val === '0') return '0';
  
  let cleaned = val.replace(/[^0-9.,]/g, '');
  cleaned = cleaned.replace(',', '.');
  
  const parts = cleaned.split('.');
  let intPart = parts[0] || '';
  let decPart = parts[1] !== undefined ? '.' + parts[1].substring(0, 2) : '';
  
  if (parts.length > 2) {
    intPart = parts[0];
    decPart = '.' + parts.slice(1).join('');
  }
  
  while (intPart.length > 2 && intPart.startsWith('0')) {
    intPart = intPart.substring(1);
  }
  
  if (intPart.startsWith('1')) {
    if (intPart.length > 3) {
      intPart = intPart.substring(0, 3);
    }
  } else {
    if (intPart.length > 2) {
      intPart = intPart.substring(0, 2);
    }
  }
  
  let parsedInt = parseInt(intPart, 10);
  if (!isNaN(parsedInt) && parsedInt > 100) {
    intPart = '100';
    decPart = '';
  }
  
  if (decPart === '') {
    if (intPart === '0') {
      return '0';
    }
    while (intPart.length < 2) {
      intPart = '0' + intPart;
    }
  }
  
  return intPart + decPart;
};

const getNewCursorPos = (originalVal, rawNewVal, formattedVal, selectionStart) => {
  if (selectionStart >= rawNewVal.length) {
    return formattedVal.length;
  }
  if (rawNewVal.length < originalVal.length && selectionStart === rawNewVal.length) {
    return formattedVal.length;
  }
  const digitsFromRight = rawNewVal.length - selectionStart;
  const newPos = formattedVal.length - digitsFromRight;
  return Math.max(0, newPos);
};

const formatCleanAverage = (val) => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0,0';
  let formatted = val.toFixed(2);
  if (formatted.endsWith('0')) {
    formatted = formatted.slice(0, -1);
  }
  return formatted.replace('.', ',');
};

const parseGeneralGrade = (val) => {
  if (!val) return 0;
  const cleaned = val.toString().replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (num >= 10 && num <= 70) {
    return num / 10;
  }
  if (num >= 1 && num <= 7) {
    return num;
  }
  return num / 10;
};

export default function Calificaciones() {
  const { effectiveSchedule } = useSchedule();
  const { user } = useAuth();

  const uniqueSubjects = effectiveSchedule 
    ? Array.from(new Set(effectiveSchedule.map(c => c.title))) 
    : [];

  const [activeSubject, setActiveSubject] = useState('');
  const [rows, setRows] = useState([
    { id: '1', note: '', weight: '' },
    { id: '2', note: '', weight: '' },
    { id: '3', note: '', weight: '' }
  ]);
  const [showBanner, setShowBanner] = useState(true);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examWeight, setExamWeight] = useState(30);
  
  // Simulator states
  const [simulatedGrade, setSimulatedGrade] = useState(4.0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const [activeCursor, setActiveCursor] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getSubjectStatus = (subjectName) => {
    if (!user) return { color: '#94a3b8', label: 'Sin notas' };
    const saved = localStorage.getItem(`academic_grades_${user.id}_${subjectName}`);
    if (!saved) return { color: '#94a3b8', label: 'Sin notas' };
    try {
      const rowsObj = JSON.parse(saved);
      const valid = rowsObj.filter(r => {
        const noteVal = parseGrade(r.note);
        const weightVal = parseFloat(r.weight);
        return r.note !== '' && r.weight !== '' && !isNaN(noteVal) && noteVal >= 1.0 && noteVal <= 7.0 && !isNaN(weightVal);
      });
      if (valid.length === 0) return { color: '#94a3b8', label: 'Sin notas' };
      const wSum = valid.reduce((sum, r) => sum + (parseGrade(r.note) * parseFloat(r.weight)), 0);
      const tWeight = valid.reduce((sum, r) => sum + parseFloat(r.weight), 0);
      const avg = tWeight > 0 ? (wSum / tWeight) : 0;
      
      if (avg >= 4.5) return { color: '#10b981', label: `Bajo (${formatCleanAverage(avg)})` };
      if (avg >= 4.0) return { color: '#f59e0b', label: `Medio (${formatCleanAverage(avg)})` };
      return { color: '#ef4444', label: `Crítico (${formatCleanAverage(avg)})` };
    } catch(e) {
      return { color: '#94a3b8', label: 'Sin notas' };
    }
  };

  const handleExportReport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      
      const content = `=========================================
AcademicAI - Boletín de Calificaciones
Estudiante: ${user?.user_metadata?.full_name || user?.email || 'Estudiante'}
Fecha de generación: ${new Date().toLocaleDateString()}
=========================================

Asignatura actual: ${activeSubject.toUpperCase()}
Promedio actual acumulado: ${formatCleanAverage(currentAverage)}
Ponderación evaluada: ${totalWeight}%

Detalle de evaluaciones:
${rows.filter(r => r.note && r.weight).map((r, i) => `Eva ${i+1}: Nota ${formatCleanAverage(parseGrade(r.note))} (${r.weight}%)`).join('\n')}

=========================================
Generado automáticamente por AcademicAI
`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `boletin_${activeSubject.toLowerCase()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Boletín descargado', '📥');
    }, 2000);
  };

  const showToast = (message, icon = '✅') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    if (activeCursor) {
      const { id, field, position } = activeCursor;
      const input = document.getElementById(`input-${id}-${field}`);
      if (input) {
        input.setSelectionRange(position, position);
      }
      setActiveCursor(null);
    }
  }, [rows, activeCursor]);

  // Set default subject
  useEffect(() => {
    if (uniqueSubjects.length > 0 && !activeSubject) {
      setActiveSubject(uniqueSubjects[0]);
    }
  }, [uniqueSubjects, activeSubject]);

  // Load grades from localStorage when subject or user changes
  useEffect(() => {
    if (user && activeSubject) {
      const saved = localStorage.getItem(`academic_grades_${user.id}_${activeSubject}`);
      if (saved) {
        setRows(JSON.parse(saved));
      } else {
        setRows([
          { id: '1', note: '', weight: '' },
          { id: '2', note: '', weight: '' },
          { id: '3', note: '', weight: '' }
        ]);
      }
      setAiResult('');
    }
  }, [activeSubject, user]);

  const saveRows = (updatedRows) => {
    setRows(updatedRows);
    if (user && activeSubject) {
      localStorage.setItem(`academic_grades_${user.id}_${activeSubject}`, JSON.stringify(updatedRows));
    }
  };

  const handleAddRow = () => {
    const newRow = {
      id: Date.now().toString(),
      note: '',
      weight: ''
    };
    saveRows([...rows, newRow]);
  };

  const handleRemoveRow = (id) => {
    const updated = rows.filter(row => row.id !== id);
    if (updated.length === 0) {
      saveRows([{ id: '1', note: '', weight: '' }]);
    } else {
      saveRows(updated);
    }
  };

  const handleInputChange = (id, field, value, e) => {
    const originalRow = rows.find(r => r.id === id);
    const originalVal = originalRow ? originalRow[field] : '';
    const selectionStart = e ? e.target.selectionStart : value.length;

    const updated = rows.map(row => {
      if (row.id === id) {
        if (field === 'note') {
          const formatted = formatNote(value);
          if (e) {
            const newPos = getNewCursorPos(originalVal, value, formatted, selectionStart);
            setActiveCursor({ id, field, position: newPos });
          }
          return { ...row, note: formatted };
        }
        if (field === 'weight') {
          const formatted = formatWeight(value);
          if (e) {
            const newPos = getNewCursorPos(originalVal, value, formatted, selectionStart);
            setActiveCursor({ id, field, position: newPos });
          }
          return { ...row, weight: formatted };
        }
      }
      return row;
    });
    saveRows(updated);
  };

  const handleClear = () => {
    const noteCount = validRows.length;
    const clearAction = () => {
      const initial = [
        { id: '1', note: '', weight: '' },
        { id: '2', note: '', weight: '' },
        { id: '3', note: '', weight: '' }
      ];
      saveRows(initial);
      setAiResult('');
    };

    if (noteCount > 4) {
      setConfirmModal({
        isOpen: true,
        title: '¿Vaciar Calificaciones?',
        message: '¿Deseas vaciar todas las calificaciones de este ramo? Esta acción no se puede deshacer.',
        onConfirm: () => {
          clearAction();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      clearAction();
      if (noteCount < 4 && noteCount > 0) {
        showToast('Calificaciones vaciadas', '🗑️');
      }
    }
  };



  // Math Calculations for single subject
  const validRows = rows.filter(r => {
    const noteVal = parseGrade(r.note);
    const weightVal = parseFloat(r.weight);
    return r.note !== '' && r.weight !== '' && !isNaN(noteVal) && noteVal >= 1.0 && noteVal <= 7.0 && !isNaN(weightVal);
  });
  
  const totalWeight = validRows.reduce((sum, r) => sum + parseFloat(r.weight), 0);
  const weightedSum = validRows.reduce((sum, r) => sum + (parseGrade(r.note) * parseFloat(r.weight)), 0);
  const hasEmptyRows = rows.some(r => r.note === '' && r.weight === '');

  const currentAverage = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
  
  const remainingWeight = Math.max(0, 100 - totalWeight);
  const finalProjectedAverage = totalWeight > 0 
    ? ((weightedSum + (4.0 * remainingWeight)) / 100) 
    : 0;

  const gradeNeededToPass = remainingWeight > 0
    ? ((4.0 * 100 - weightedSum) / remainingWeight)
    : 0;

  let trend = 'none';
  if (validRows.length >= 2) {
    const n = validRows.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    validRows.forEach((row, index) => {
      const x = index + 1;
      const y = parseGrade(row.note);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const denominator = (n * sumXX) - (sumX * sumX);
    if (denominator !== 0) {
      const slope = ((n * sumXY) - (sumX * sumY)) / denominator;
      if (slope > 0.05) trend = 'up';
      else if (slope < -0.05) trend = 'down';
    }
  }

  const presentationGrade = currentAverage;
  const examFactor = examWeight / 100;
  const presentationFactor = 1 - examFactor;
  const examGradeRequired = examFactor > 0 
    ? ((4.0 - (presentationGrade * presentationFactor)) / examFactor) 
    : 0;

  const simulatedFinalAverage = (weightedSum + (simulatedGrade * remainingWeight)) / 100;

  // Risk Semaphore calculation
  let riskLevel = 'bajo';
  let riskLabel = 'Bajo';
  let riskColor = '#10b981';

  if (validRows.length > 0) {
    if (remainingWeight === 0) {
      if (currentAverage < 4.0) {
        riskLevel = 'critico';
        riskLabel = 'Crítico (Reprobado)';
        riskColor = '#ef4444';
      } else if (currentAverage >= 4.0 && currentAverage <= 4.5) {
        riskLevel = 'medio';
        riskLabel = `Medio (Aprobado al límite: ${formatCleanAverage(currentAverage)})`;
        riskColor = '#f59e0b';
      } else {
        riskLevel = 'bajo';
        riskLabel = 'Bajo (Aprobado)';
        riskColor = '#10b981';
      }
    } else {
      if (gradeNeededToPass > 7.0) {
        riskLevel = 'critico';
        riskLabel = 'Crítico (Aprobación Imposible)';
        riskColor = '#ef4444';
      } else if (gradeNeededToPass > 5.5) {
        riskLevel = 'critico';
        riskLabel = `Crítico (Falta nota alta: ${formatCleanAverage(gradeNeededToPass)})`;
        riskColor = '#ef4444';
      } else if (currentAverage < 3.0) {
        riskLevel = 'critico';
        riskLabel = `Crítico (Promedio muy bajo: ${formatCleanAverage(currentAverage)})`;
        riskColor = '#ef4444';
      } else if (gradeNeededToPass > 4.0 && gradeNeededToPass <= 5.5) {
        riskLevel = 'medio';
        riskLabel = `Medio (Requiere ${formatCleanAverage(gradeNeededToPass)})`;
        riskColor = '#f59e0b';
      } else if (currentAverage >= 3.0 && currentAverage < 4.3) {
        riskLevel = 'medio';
        riskLabel = `Medio (Promedio bajo: ${formatCleanAverage(currentAverage)})`;
        riskColor = '#f59e0b';
      } else {
        riskLevel = 'bajo';
        riskLabel = 'Bajo';
        riskColor = '#10b981';
      }
    }
  }

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiResult('');
    try {
      const result = await getAcademicRiskAnalysis(
        activeSubject,
        validRows,
        remainingWeight,
        gradeNeededToPass
      );
      setAiResult(result);
    } catch (err) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        title: 'Error de Conexión',
        message: 'No se pudo obtener el análisis de riesgo. Por favor, verifica la conexión con el servicio de Inteligencia Artificial (Groq).'
      });
    } finally {
      setAiLoading(false);
    }
  };

  if (uniqueSubjects.length === 0) {
    return (
      <main className="main-content">
        <header style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Calculadora de promedio</h1>
            <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
              Configura tu horario para habilitar las calificaciones por materia o ingresa directamente tus notas individuales.
            </p>
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
          <GraduationCap size={64} style={{ color: 'var(--primary)', opacity: 0.8 }} />
          <div>
            <h3>Configura tu horario para habilitar la calculadora</h3>
            <p style={{ marginTop: '8px', maxWidth: '400px', marginBottom: '20px' }}>
              Para poder simular y estimar tus promedios, primero debes configurar tu horario semanal de clases.
            </p>
            <button 
              onClick={() => window.location.href = '/horario'}
              className="btn-primary"
              style={{ padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', margin: '0 auto' }}
            >
              ✏️ Ir a Mi Horario
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <header style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title">Calculadora de promedio</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
            Calcula tus promedios, simula notas futuras y predice riesgos de reprobación (Escala 1.0 - 7.0)
          </p>
        </div>
      </header>

      {showBanner && totalWeight > 0 && totalWeight < 100 && (
        <div className="info-alert-banner" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Info size={20} />
            <span>Si tus porcentajes suman menos del 100%, se calcula un promedio ponderado proporcional a lo ingresado.</span>
          </div>
          <button className="btn-close-banner" onClick={() => setShowBanner(false)}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grades-main-layout" style={{
        display: 'grid',
        gridTemplateColumns: windowWidth > 900 ? '1.2fr 1fr' : '1fr',
        gap: '24px',
        maxWidth: windowWidth > 900 ? '850px' : '650px',
        margin: '0 auto',
        width: '100%',
        alignItems: 'start'
      }}>
            
            {/* COLUMNA IZQUIERDA: CALCULADORA DE NOTAS (Estilo Sketch) */}
            <div className="card-glass-calc" style={{
              background: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              
              {/* ASIGNATURA/RAMO DROPDOWN - CENTRADO Y ALTAMENTE INTERACTIVO */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px', position: 'relative' }}>
                <div style={{
                  border: '1px solid var(--border-color)',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: 'fit-content',
                  position: 'relative'
                }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.85rem', letterSpacing: '0.5px' }}>ASIGNATURA/RAMO:</span>
                  <div style={{ position: 'relative' }}>
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg)',
                        color: 'var(--text-main)',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      <span>{activeSubject || 'SELECCIONA'}</span>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: activeSubject ? getSubjectStatus(activeSubject).color : '#94a3b8'
                      }} />
                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>▼</span>
                    </button>
                    
                    {isDropdownOpen && (
                      <>
                        <div 
                          onClick={() => setIsDropdownOpen(false)} 
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginTop: '8px',
                          background: 'var(--sidebar-bg)',
                          backdropFilter: 'blur(25px)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '16px',
                          boxShadow: 'var(--shadow-lg)',
                          width: '280px',
                          zIndex: 999,
                          padding: '8px',
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}>
                          {uniqueSubjects.map((sub, idx) => {
                            const status = getSubjectStatus(sub);
                            const isSel = sub === activeSubject;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setActiveSubject(sub);
                                  setIsDropdownOpen(false);
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderRadius: '10px',
                                  border: 'none',
                                  background: isSel ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                  color: isSel ? 'var(--primary)' : 'var(--text-main)',
                                  fontWeight: isSel ? '700' : '500',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: '0.15s',
                                  textTransform: 'uppercase',
                                  marginBottom: '2px'
                                }}
                                onMouseOver={(e) => {
                                  if (!isSel) e.currentTarget.style.background = 'var(--primary-light)';
                                }}
                                onMouseOut={(e) => {
                                  if (!isSel) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <span>{sub}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{status.label}</span>
                                  <span style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: status.color
                                  }} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* LISTADO DE ENTRADAS CON COLUMNAS SEPARADAS (NOTA Y VALOR) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    padding: '10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Nota
                  </div>
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    padding: '10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Valor
                  </div>
                  <div style={{ width: '32px' }}></div> {/* Espacio para el botón de eliminar */}
                </div>

                <div className="grades-list-rows">
                  {rows.map((row) => {
                    const parsedNoteVal = row.note ? parseGrade(row.note) : 0;
                    const isNoteInvalid = row.note !== '' && (parsedNoteVal < 1.0 || parsedNoteVal > 7.0);

                    const parsedWeightVal = row.weight ? parseFloat(row.weight) : 0;
                    const isWeightInvalid = row.weight !== '' && (isNaN(parsedWeightVal) || parsedWeightVal < 1 || parsedWeightVal > 100);

                    return (
                      <div key={row.id} className="grade-row" style={{ display: 'flex', gap: '20px', marginBottom: '12px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <input 
                            id={`input-${row.id}-note`}
                            type="text" 
                            value={row.note} 
                            onChange={(e) => handleInputChange(row.id, 'note', e.target.value, e)}
                            placeholder="Ej: 55"
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '12px',
                              border: isNoteInvalid ? '1px solid #ef4444' : '1px solid var(--border-color)',
                              background: 'rgba(0,0,0,0.15)',
                              color: 'var(--text-main)',
                              fontSize: '0.95rem',
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                          {isNoteInvalid && (
                            <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', textAlign: 'center' }}>
                              Nota inválida (1.0 - 7.0)
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <input 
                            id={`input-${row.id}-weight`}
                            type="text" 
                            value={row.weight} 
                            onChange={(e) => handleInputChange(row.id, 'weight', e.target.value, e)}
                            placeholder="%"
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '12px',
                              border: isWeightInvalid ? '1px solid #ef4444' : '1px solid var(--border-color)',
                              background: 'rgba(0,0,0,0.15)',
                              color: 'var(--text-main)',
                              fontSize: '0.95rem',
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                          {isWeightInvalid && (
                            <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', textAlign: 'center' }}>
                              Ponderación inválida (1 - 100%)
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => handleRemoveRow(row.id)} 
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            width: '32px',
                            marginTop: '8px',
                            flexShrink: 0
                          }}
                          title="Eliminar Nota"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACCIONES AL PIE DE LA CALCULADORA */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setExamModalOpen(true)}
                    disabled={validRows.length === 0}
                    style={{
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      fontWeight: '600',
                      cursor: validRows.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: validRows.length === 0 ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: '0.2s'
                    }}
                  >
                    <HelpCircle size={16} /> Simular Examen
                  </button>
                  <button 
                    onClick={handleClear} 
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      padding: '10px 18px',
                      borderRadius: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: '0.2s'
                    }}
                  >
                    Limpiar
                  </button>
                  <button 
                    onClick={handleExportReport}
                    disabled={validRows.length === 0 || isExporting}
                    style={{
                      background: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.2)',
                      color: 'var(--primary)',
                      padding: '10px 18px',
                      borderRadius: '12px',
                      fontWeight: '600',
                      cursor: (validRows.length === 0 || isExporting) ? 'not-allowed' : 'pointer',
                      transition: '0.2s',
                      opacity: (validRows.length === 0 || isExporting) ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => {
                      if (validRows.length > 0 && !isExporting) e.currentTarget.style.background = 'rgba(14, 165, 233, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      if (validRows.length > 0 && !isExporting) e.currentTarget.style.background = 'rgba(14, 165, 233, 0.1)';
                    }}
                  >
                    📥 Exportar Boletín
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>Total: <span style={{ color: totalWeight === 100 ? '#22c55e' : '#f59e0b', fontWeight: 'bold' }}>{totalWeight}%</span></span>
                    {totalWeight > 100 && (
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        ⚠️ Exceso de ponderación (+{totalWeight - 100}%)
                      </span>
                    )}
                    {totalWeight < 100 && totalWeight > 0 && !hasEmptyRows && (
                      <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        ⚠️ Falta ponderación ({100 - totalWeight}% restante)
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={handleAddRow}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(14, 165, 233, 0.1)',
                      color: 'var(--primary)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: '0.2s'
                    }}
                    title="Añadir Nota"
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.1)'}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: PRONÓSTICO Y SIMULADORES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SEMÁFORO DE RIESGO */}
              <div className="card-glass-risk" style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Semáforo de Riesgo Académico</h4>
                
                {/* Visual Traffic Lights */}
                <div className="semaforo-panel" style={{
                  display: 'flex',
                  gap: '15px',
                  justifyContent: 'center',
                  margin: '20px 0',
                  padding: '12px 20px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '20px',
                  width: 'fit-content',
                  marginRight: 'auto',
                  marginLeft: 'auto'
                }}>
                  {/* Red Light */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: riskLevel === 'critico' ? '#ef4444' : '#521010',
                    boxShadow: riskLevel === 'critico' ? '0 0 15px #ef4444, inset 0 0 10px rgba(255,255,255,0.4)' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                  {/* Yellow Light */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: riskLevel === 'medio' ? '#f59e0b' : '#523106',
                    boxShadow: riskLevel === 'medio' ? '0 0 15px #f59e0b, inset 0 0 10px rgba(255,255,255,0.4)' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                  {/* Green Light */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: riskLevel === 'bajo' ? '#10b981' : '#083325',
                    boxShadow: riskLevel === 'bajo' ? '0 0 15px #10b981, inset 0 0 10px rgba(255,255,255,0.4)' : 'none',
                    transition: 'all 0.3s ease'
                  }} />
                </div>

                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: '800',
                  color: riskColor,
                  marginBottom: '10px'
                }}>
                  Riesgo: {riskLabel}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px 0', lineHeight: '1.4' }}>
                  {validRows.length === 0 
                    ? 'Ingresa calificaciones y ponderaciones para calcular el semáforo de riesgo.'
                    : remainingWeight > 0
                      ? `Falta el ${remainingWeight}% del ramo por evaluar. El sistema calcula tus probabilidades en base a la nota mínima y tu tendencia actual.`
                      : 'Asignatura calificada al 100%. No restan evaluaciones.'
                  }
                </p>

                <button
                  onClick={handleAIAnalysis}
                  disabled={validRows.length === 0 || aiLoading}
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    color: '#a78bfa',
                    padding: '12px 20px',
                    borderRadius: '14px',
                    fontWeight: '700',
                    cursor: (validRows.length === 0 || aiLoading) ? 'not-allowed' : 'pointer',
                    opacity: (validRows.length === 0 || aiLoading) ? 0.6 : 1,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: '0.2s'
                  }}
                  onMouseOver={(e) => {
                    if(validRows.length > 0 && !aiLoading) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)';
                  }}
                  onMouseOut={(e) => {
                    if(validRows.length > 0 && !aiLoading) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                  }}
                >
                  {aiLoading ? (
                    <>
                      <Loader size={16} className="lucide-spin" /> Analizando tu situación...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Predecir Éxito con IA
                    </>
                  )}
                </button>
              </div>

              {/* SIMULADOR DE ESCENARIOS (NOTAS FUTURAS) */}
              {validRows.length > 0 && remainingWeight > 0 && (
                <div className="card-glass-simulator" style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '24px',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} color="var(--primary)" /> Simulador de Nota Faltante
                  </h4>
                  
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '18px' }}>
                    Ajusta la barra para estimar qué nota necesitas obtener en promedio en el <strong>{remainingWeight}%</strong> restante para alcanzar tu meta.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nota esperada restante:</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>{formatCleanAverage(parseFloat(simulatedGrade))}</span>
                  </div>

                  <input 
                    type="range"
                    min="1.0"
                    max="7.0"
                    step="0.1"
                    value={simulatedGrade}
                    onChange={(e) => setSimulatedGrade(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      outline: 'none',
                      cursor: 'pointer',
                      background: 'var(--border-color)',
                      WebkitAppearance: 'none',
                      marginBottom: '20px'
                    }}
                  />

                  <div style={{
                    background: 'rgba(0,0,0,0.15)',
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>PROMEDIO FINAL SIMULADO:</span>
                    <span style={{
                      fontSize: '1.25rem',
                      fontWeight: '900',
                      color: simulatedFinalAverage >= 4.0 ? '#10b981' : '#ef4444'
                    }}>
                      {formatCleanAverage(simulatedFinalAverage)}
                    </span>
                  </div>
                </div>
              )}

              {/* HISTORIAL / RESULTADOS SIMPLES */}
              <div className="card-glass-results" style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1rem', color: 'var(--text-main)' }}>Métricas del Período</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Promedio Actual Acumulado:</span>
                    <span style={{ fontWeight: 'bold', color: currentAverage >= 4.0 ? '#10b981' : '#ef4444' }}>
                      {validRows.length > 0 ? formatCleanAverage(currentAverage) : '0,0'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Puntaje Final si lo restante = 4,0:</span>
                    <span style={{ fontWeight: 'bold', color: finalProjectedAverage >= 4.0 ? '#10b981' : '#ef4444' }}>
                      {validRows.length > 0 ? formatCleanAverage(finalProjectedAverage) : '0,0'}
                    </span>
                  </div>
                  {remainingWeight > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Exigido para pasar (4,0):</span>
                      <span style={{ fontWeight: 'bold', color: gradeNeededToPass > 7.0 ? '#ef4444' : 'var(--text-main)' }}>
                        {gradeNeededToPass > 7.0 ? 'Imposible (> 7,0)' : formatCleanAverage(gradeNeededToPass)}
                      </span>
                    </div>
                  )}
                </div>

                {validRows.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    {trend === 'down' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <TrendingDown size={16} /> <span>Tendencia descendente. Considera estudiar más horas de este ramo.</span>
                      </div>
                    )}
                    {trend === 'up' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem', color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <TrendingUp size={16} /> <span>Tendencia ascendente. ¡Excelente progreso en tus últimas notas!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

          </div>

      {/* RESULTADO DE LA IA PROGNOSIS */}
      {aiResult && (
        <div style={{
          marginTop: '30px',
          background: 'rgba(139, 92, 246, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', color: '#c084fc' }}>
            <Sparkles size={20} /> Pronóstico y Mentoría Académica IA
          </h3>
          <div 
            className="markdown-body"
            style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ __html: marked.parse(aiResult) }}
          />
        </div>
      )}

      {/* Exam Simulation Modal */}
      {examModalOpen && (
        <div className="modal-overlay" onClick={() => setExamModalOpen(false)}>
          <div className="premium-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}><GraduationCap size={24} color="var(--primary)" /> Simulación de Examen</h3>
              <button 
                onClick={() => setExamModalOpen(false)} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Simula el escenario final de la asignatura. Tu promedio actual de <strong>{formatCleanAverage(currentAverage)}</strong> representará tu nota de presentación al examen.
              </p>
              
              <div className="form-group-premium">
                <label>Ponderación del Examen Final (%)</label>
                <input 
                  type="number" 
                  className="premium-input" 
                  style={{ paddingLeft: '15px' }}
                  value={examWeight}
                  onChange={(e) => setExamWeight(Math.max(1, Math.min(99, parseInt(e.target.value) || 30)))}
                  min="1"
                  max="99"
                />
              </div>

              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nota Presentación ({100 - examWeight}%):</span>
                  <span style={{ color: 'var(--text-main)' }}>{formatCleanAverage(presentationGrade)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
                  <span style={{ color: 'var(--primary)' }}>Nota Examen Necesaria ({examWeight}%):</span>
                  <span style={{ color: examGradeRequired > 7.0 ? '#ef4444' : '#22c55e' }}>
                    {examGradeRequired <= 1.0 ? '1,0' : (examGradeRequired > 7.0 ? 'Imposible (> 7,0)' : formatCleanAverage(examGradeRequired))}
                  </span>
                </div>
              </div>

              {examGradeRequired > 7.0 ? (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, display: 'flex', gap: '5px', marginTop: '5px' }}>
                  ⚠️ Incluso obteniendo nota máxima (7,0) en el examen, tu nota final proyectada no alcanzará el 4,0 requerido para aprobar.
                </div>
              ) : examGradeRequired <= 1.0 ? (
                <div style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, display: 'flex', gap: '5px', marginTop: '5px' }}>
                  ✅ Ya estás aprobado. Incluso con la nota mínima (1,0) en tu examen final, tu promedio final superará el 4,0 aprobatorio.
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', gap: '5px', marginTop: '5px' }}>
                  ℹ️ Necesitas obtener al menos un <strong>{formatCleanAverage(examGradeRequired)}</strong> en el examen para alcanzar el promedio final mínimo de 4,0 y aprobar la asignatura.
                </div>
              )}

              <button 
                onClick={() => setExamModalOpen(false)} 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '15px' }}
              >
                Cerrar Simulación
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className="toast-notification">
              <span style={{ fontSize: '1.2rem' }}>{toast.icon}</span>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Styles for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Custom Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200
        }}>
          <div className="premium-modal" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle color="#f59e0b" size={24} /> {confirmModal.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '12px', lineHeight: '1.4' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertModal.isOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200
        }}>
          <div className="premium-modal" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info color="var(--primary)" size={24} /> {alertModal.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '12px', lineHeight: '1.4' }}>
              {alertModal.message}
            </p>
            <button 
              onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
              className="btn-primary" 
              style={{ width: '100%', marginTop: '20px' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Exporting Modal */}
      {isExporting && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <div className="premium-modal" style={{
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            padding: '40px 24px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <Loader size={48} className="lucide-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Generando Boletín Académico</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
                Procesando calificaciones y estimaciones en PDF...
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
