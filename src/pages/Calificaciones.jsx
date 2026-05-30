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
  const [examWeight, setExamWeight] = useState(30); // 30% default for Chilean university exams
  
  // Simulator states
  const [simulatedGrade, setSimulatedGrade] = useState(4.0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

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

  const handleInputChange = (id, field, value) => {
    const updated = rows.map(row => {
      if (row.id === id) {
        if (field === 'note') {
          const parsed = parseFloat(value);
          if (value === '' || (!isNaN(parsed) && parsed >= 1 && parsed <= 7) || value === '1' || value === '2' || value === '3' || value === '4' || value === '5' || value === '6' || value === '7' || value.endsWith('.') || value.endsWith(',')) {
            const formatted = value.replace(',', '.');
            return { ...row, note: formatted };
          }
          return row;
        }
        if (field === 'weight') {
          const parsed = parseInt(value);
          if (value === '' || (!isNaN(parsed) && parsed >= 0 && parsed <= 100)) {
            return { ...row, weight: value };
          }
          return row;
        }
      }
      return row;
    });
    saveRows(updated);
  };

  const handleClear = () => {
    if (window.confirm('¿Deseas vaciar todas las calificaciones de este ramo?')) {
      const initial = [
        { id: '1', note: '', weight: '' },
        { id: '2', note: '', weight: '' },
        { id: '3', note: '', weight: '' }
      ];
      saveRows(initial);
      setAiResult('');
    }
  };

  // Math Calculations
  const validRows = rows.filter(r => r.note !== '' && r.weight !== '' && !isNaN(parseFloat(r.note)) && !isNaN(parseFloat(r.weight)));
  
  const totalWeight = validRows.reduce((sum, r) => sum + parseFloat(r.weight), 0);
  const weightedSum = validRows.reduce((sum, r) => sum + (parseFloat(r.note) * parseFloat(r.weight)), 0);

  // Proportional average (if weights < 100, normalize)
  const currentAverage = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
  
  // Final projected average assuming remaining weights get 4.0 (passing score)
  const remainingWeight = Math.max(0, 100 - totalWeight);
  const finalProjectedAverage = totalWeight > 0 
    ? ((weightedSum + (4.0 * remainingWeight)) / 100) 
    : 0;

  // Grade needed in remaining weight to pass (4.0)
  const gradeNeededToPass = remainingWeight > 0
    ? ((4.0 * 100 - weightedSum) / remainingWeight)
    : 0;

  // Grade needed in remaining weight to exempt from exam (5.0)
  const gradeNeededToExempt = remainingWeight > 0
    ? ((5.0 * 100 - weightedSum) / remainingWeight)
    : 0;

  // Linear regression slope to check trend
  let trend = 'none'; // 'none' | 'up' | 'down'
  if (validRows.length >= 2) {
    const n = validRows.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    validRows.forEach((row, index) => {
      const x = index + 1;
      const y = parseFloat(row.note);
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

  // Final Exam simulation logic
  const presentationGrade = currentAverage;
  const examFactor = examWeight / 100;
  const presentationFactor = 1 - examFactor;
  const examGradeRequired = examFactor > 0 
    ? ((4.0 - (presentationGrade * presentationFactor)) / examFactor) 
    : 0;

  // Future grade simulator logic
  const simulatedFinalAverage = (weightedSum + (simulatedGrade * remainingWeight)) / 100;

  // Risk Semaphore calculation
  let riskLevel = 'bajo'; // 'bajo' | 'medio' | 'critico'
  let riskLabel = 'Bajo';
  let riskColor = '#10b981';

  if (validRows.length > 0) {
    if (remainingWeight === 0) {
      if (currentAverage < 4.0) {
        riskLevel = 'critico';
        riskLabel = 'Crítico (Reprobado)';
        riskColor = '#ef4444';
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
        riskLabel = `Crítico (Falta nota alta: ${gradeNeededToPass.toFixed(1)})`;
        riskColor = '#ef4444';
      } else if (gradeNeededToPass > 4.0) {
        riskLevel = 'medio';
        riskLabel = `Medio (Requiere ${gradeNeededToPass.toFixed(1)})`;
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
      alert("No se pudo obtener el análisis de riesgo. Por favor, verifica la conexión.");
    } finally {
      setAiLoading(false);
    }
  };

  if (uniqueSubjects.length === 0) {
    return (
      <main className="main-content">
        <header>
          <div>
            <h1>Mis Calificaciones</h1>
            <p className="subtitle">Carga tu horario para habilitar las calificaciones por materia</p>
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
            <h3>Carga tu horario para habilitar las calificaciones</h3>
            <p style={{ marginTop: '8px', maxWidth: '400px' }}>
              Para estimar tus promedios por materia, primero debes cargar o configurar tu horario semanal.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <header style={{ marginBottom: '35px' }}>
        <div>
          <h1>Control de Calificaciones</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
            Calcula tus promedios, simula notas futuras y predice riesgos de reprobación (Escala 1.0 - 7.0)
          </p>
        </div>
      </header>

      <div className="grades-header-actions" style={{ marginBottom: '20px' }}>
        <div className="grades-subject-select-wrapper">
          <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>Asignatura:</span>
          <select 
            value={activeSubject} 
            onChange={(e) => setActiveSubject(e.target.value)}
            style={{
              padding: '10px 15px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg)',
              color: 'var(--text-main)',
              fontWeight: 'bold',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {uniqueSubjects.map((sub, idx) => (
              <option key={idx} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Ponderación Ingresada: <span style={{ color: totalWeight === 100 ? '#22c55e' : '#f59e0b', fontWeight: 'bold' }}>{totalWeight}%</span> / 100%
        </div>
      </div>

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
      <div className="grades-main-layout">
        
        {/* COLUMNA IZQUIERDA: CALCULADORA DE NOTAS */}
        <div className="card-glass-calc" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
            <GraduationCap color="var(--primary)" /> Calificaciones de {activeSubject}
          </h3>

          <div className="grades-list-rows">
            {rows.map((row) => (
              <div key={row.id} className="grade-row" style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  value={row.note} 
                  onChange={(e) => handleInputChange(row.id, 'note', e.target.value)}
                  placeholder="Nota (Ej: 5.5)"
                  title="Calificación del 1.0 al 7.0"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(0,0,0,0.1)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <input 
                  type="number" 
                  value={row.weight} 
                  onChange={(e) => handleInputChange(row.id, 'weight', e.target.value)}
                  placeholder="Porcentaje %"
                  min="0"
                  max="100"
                  title="Porcentaje de la nota"
                  style={{
                    flex: 1.5,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(0,0,0,0.1)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
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
                    transition: 'all 0.2s'
                  }}
                  title="Eliminar Nota"
                  onMouseOver={(e) => e.currentTarget.style.color = '#dc2626'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#ef4444'}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', alignItems: 'center' }}>
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
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>{parseFloat(simulatedGrade).toFixed(1)}</span>
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
                  {simulatedFinalAverage.toFixed(2)}
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
                  {validRows.length > 0 ? currentAverage.toFixed(2) : '0.00'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Puntaje Final si lo restante = 4.0:</span>
                <span style={{ fontWeight: 'bold', color: finalProjectedAverage >= 4.0 ? '#10b981' : '#ef4444' }}>
                  {validRows.length > 0 ? finalProjectedAverage.toFixed(2) : '0.00'}
                </span>
              </div>
              {remainingWeight > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Exigido para pasar (4.0):</span>
                  <span style={{ fontWeight: 'bold', color: gradeNeededToPass > 7.0 ? '#ef4444' : 'var(--text-main)' }}>
                    {gradeNeededToPass > 7.0 ? 'Imposible (> 7.0)' : gradeNeededToPass.toFixed(2)}
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
                Simula el escenario final de la asignatura. Tu promedio actual de <strong>{currentAverage.toFixed(2)}</strong> representará tu nota de presentación al examen.
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
                  <span style={{ color: 'var(--text-main)' }}>{presentationGrade.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
                  <span style={{ color: 'var(--primary)' }}>Nota Examen Necesaria ({examWeight}%):</span>
                  <span style={{ color: examGradeRequired > 7.0 ? '#ef4444' : '#22c55e' }}>
                    {examGradeRequired <= 1.0 ? '1.0' : (examGradeRequired > 7.0 ? 'Imposible (> 7.0)' : examGradeRequired.toFixed(2))}
                  </span>
                </div>
              </div>

              {examGradeRequired > 7.0 ? (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, display: 'flex', gap: '5px', marginTop: '5px' }}>
                  ⚠️ Incluso obteniendo nota máxima (7.0) en el examen, tu nota final proyectada no alcanzará el 4.0 requerido para aprobar.
                </div>
              ) : examGradeRequired <= 1.0 ? (
                <div style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, display: 'flex', gap: '5px', marginTop: '5px' }}>
                  ✅ Ya estás aprobado. Incluso con la nota mínima (1.0) en tu examen final, tu promedio final superará el 4.0 aprobatorio.
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', gap: '5px', marginTop: '5px' }}>
                  ℹ️ Necesitas obtener al menos un <strong>{examGradeRequired.toFixed(2)}</strong> en el examen para alcanzar el promedio final mínimo de 4.0 y aprobar la asignatura.
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
    </main>
  );
}
