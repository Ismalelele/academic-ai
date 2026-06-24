import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Loader, BookOpen, Clock, Calendar, Tag, Sparkles, AlignLeft, Pencil, Check, CheckCircle2, RotateCcw, ArrowUp, ArrowDown, Ban } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';

const formatDeadlineSafely = (deadlineStr) => {
  if (!deadlineStr) return 'Sin fecha';
  const cleanStr = deadlineStr.substring(0, 10);
  const parts = cleanStr.split('-');
  if (parts.length !== 3) return deadlineStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

export default function Tareas() {
  const { effectiveSchedule, studyBlocks, predefBlocks, generateStudyRoutine, restoreStudyBlocks, isProcessing, clearStudyBlocks, updateStudyBlock, deleteStudyBlock, updateClass } = useSchedule();
  const { tasks, isLoading, addTask, updateTaskStatus, updateTask, deleteTask, deleteMultipleTasks } = useTasks();
  const { user } = useAuth();

  const uniqueSubjects = effectiveSchedule ? Array.from(new Set(effectiveSchedule.map(c => c.title))) : [];

  // ── Cómputo de resumen de tareas ────────────────────────
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.deadline) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const parts = t.deadline.substring(0, 10).split('-');
    const dl = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return dl < today;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    tag: 'General',
    deadline: '',
    estimatedTime: 2,
    type: 'Tarea'
  });
  const [editingTask, setEditingTask] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState({
    title: '',
    tag: 'General',
    type: 'Tarea',
    deadline: '',
    estimatedTime: 2,
    status: 'todo'
  });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedStudyBlockId, setDraggedStudyBlockId] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Snapshot para deshacer la ultima regeneracion automatica del planificador
  const [previousStudyBlocks, setPreviousStudyBlocks] = useState(null);

  const [editingStudyBlock, setEditingStudyBlock] = useState(null);
  const [editStudyBlockData, setEditStudyBlockData] = useState({
    day: 0,
    startTime: '08:15',
    endTime: '08:55'
  });

  const showToast = (message, icon = '✅') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, icon }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!newTaskData.title.trim()) return;

    const hours = parseInt(newTaskData.estimatedTime) || 2;

    await addTask(
      newTaskData.title,
      'todo',
      newTaskData.tag,
      newTaskData.deadline,
      hours,
      newTaskData.type,
      1
    );

    setNewTaskData({
      title: '', tag: 'General', deadline: '', estimatedTime: 2, type: 'Tarea'
    });
    setIsModalOpen(false);
    showToast('Evaluación creada.', '✅');
  };

  const handleEditTaskClick = (task) => {
    setEditingTask(task);
    setEditTaskData({
      title: task.title || '',
      tag: task.tag || 'General',
      type: task.type || 'Tarea',
      deadline: task.deadline ? task.deadline.substring(0, 10) : '',
      estimatedTime: task.estimatedTime || 2,
      status: task.status || 'todo'
    });
    setIsEditModalOpen(true);
  };

  const handleEditModalSubmit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    const hours = parseInt(editTaskData.estimatedTime) || 2;

    await updateTask(editingTask.id, {
      title: editTaskData.title,
      tag: editTaskData.tag,
      type: editTaskData.type,
      deadline: editTaskData.deadline || null,
      estimatedTime: hours,
      status: editTaskData.status
    });

    setIsEditModalOpen(false);
    setEditingTask(null);
    showToast('Tarea actualizada correctamente.', '📝');
  };

  const handleEditStudyBlockClick = (block) => {
    setEditingStudyBlock(block);
    setEditStudyBlockData({
      day: block.day,
      startTime: `${block.startH.toString().padStart(2, '0')}:${block.startM.toString().padStart(2, '0')}`,
      endTime: `${block.endH.toString().padStart(2, '0')}:${block.endM.toString().padStart(2, '0')}`
    });
  };

  const handleEditStudyBlockSubmit = (e) => {
    e.preventDefault();
    if (!editingStudyBlock) return;

    const [startH, startM] = editStudyBlockData.startTime.split(':').map(Number);
    const [endH, endM] = editStudyBlockData.endTime.split(':').map(Number);

    const result = updateStudyBlock(editingStudyBlock.id, editStudyBlockData.day, startH, startM, endH, endM);
    if (result && !result.success) {
      showToast(result.reason, '⚠️');
      return;
    }
    setEditingStudyBlock(null);
  };

  const handleDeleteStudyBlock = () => {
    if (editingStudyBlock) {
      deleteStudyBlock(editingStudyBlock.id);
      setEditingStudyBlock(null);
      showToast('Bloque de estudio eliminado.', '🗑️');
    }
  };

  const handleDeleteTask = async (id) => {
    const success = await deleteTask(id);
    if (success) {
      showToast('Se eliminó 1 tarea.', '🗑️');
    } else {
      showToast('Error al eliminar la tarea.', '❌');
    }
  };

  const handleDragStart = (e, id) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (el) el.classList.add('is-dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    const el = document.querySelector(`[data-id="${draggedTaskId}"]`);
    if (el) el.classList.remove('is-dragging');
    setDraggedTaskId(null);
    setHoveredDay(null);
    setHoveredSlot(null);
    setDraggedStudyBlockId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.remove('drag-over');
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.remove('drag-over');

    if (draggedTaskId) {
      const draggedTask = tasks.find(t => t.id === draggedTaskId);
      if (draggedTask && draggedTask.status !== status) {
        await updateTaskStatus(draggedTaskId, status);
      }
    }
  };

  const handleScheduleCardDragStart = (e, cardId, cardType) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ cardId, cardType }));
    if (cardType === 'study') {
      setDraggedStudyBlockId(cardId);
    }
  };

  const handleDragOverTrack = (e, dayIndex) => {
    e.preventDefault();
    const trackElement = e.currentTarget;
    const rect = trackElement.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const slotIndex = Math.floor(relativeY / 50);
    if (slotIndex >= 0 && slotIndex < predefBlocks.length) {
      setHoveredDay(dayIndex);
      setHoveredSlot(slotIndex);
    }
  };

  const handleScheduleCardDrop = (e, dayIndex) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    
    try {
      const { cardId, cardType } = JSON.parse(dataStr);
      if (cardType !== 'study') return;
      
      const trackElement = e.currentTarget;
      const rect = trackElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      const slotIndex = Math.floor(relativeY / 50);
      if (slotIndex < 0 || slotIndex >= predefBlocks.length) return;
      
      const draggedCard = studyBlocks.find(c => c.id === cardId);
      if (!draggedCard) return;
      
      const startIdx = predefBlocks.findIndex(b => Number(b.startH) === Number(draggedCard.startH) && Number(b.startM) === Number(draggedCard.startM));
      const endIdx = predefBlocks.findIndex(b => Number(b.endH) === Number(draggedCard.endH) && Number(b.endM) === Number(draggedCard.endM));
      const slotSpan = (startIdx !== -1 && endIdx !== -1) ? (endIdx - startIdx + 1) : 1;
      
      const newStartIdx = slotIndex;
      const newEndIdx = Math.min(slotIndex + slotSpan - 1, predefBlocks.length - 1);
      
      const newStartH = predefBlocks[newStartIdx].startH;
      const newStartM = predefBlocks[newStartIdx].startM;
      const newEndH = predefBlocks[newEndIdx].endH;
      const newEndM = predefBlocks[newEndIdx].endM;
      
      updateStudyBlock(cardId, dayIndex, newStartH, newStartM, newEndH, newEndM);
      setDraggedStudyBlockId(null);
      // No toast notification sent here, per user requirement
    } catch (err) {
      console.error("Error on schedule drop:", err);
    }
  };

  const moveTask = async (id, newStatus) => {
    if (!newStatus) return;
    // Siempre mover directamente, sin abrir modal
    await updateTaskStatus(id, newStatus);
  };

  const getPrevStatus = (status) => {
    if (status === 'todo') return 'inbox';
    if (status === 'in-progress') return 'todo';
    if (status === 'done') return 'in-progress';
    return null;
  };

  const getNextStatus = (status) => {
    if (status === 'inbox') return 'todo';
    if (status === 'todo') return 'in-progress';
    if (status === 'in-progress') return 'done';
    return null;
  };

  const getTasksByStatus = (status) => tasks.filter(t => t.status === status);

  const statusMap = {
    'inbox': 'Bandeja de Entrada',
    'todo': 'Por hacer',
    'in-progress': 'En progreso',
    'done': 'Terminado'
  };

  const renderColumn = (title, status, emoji) => (
    <div
      className="kanban-column"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, status)}
    >
      <div className="kanban-column-header">
        <h3>{emoji} {title}</h3>
        <span className="task-count">{getTasksByStatus(status).length}</span>
      </div>
      <div className="kanban-cards-container">
        {getTasksByStatus(status).map(task => {
          const isDone = task.status === 'done';
          return (
            <div
              key={task.id}
              className={`kanban-card ${isDone ? 'done-card' : ''}`}
              draggable={!isDone}
              data-id={task.id}
              onDragStart={(e) => handleDragStart(e, task.id)}
              onDragEnd={handleDragEnd}
            >
              {!isDone && (
                <div className="kanban-card-drag-handle">
                  <GripVertical size={16} color="var(--text-muted)" />
                </div>
              )}

              <div className="kanban-card-content">
                <div className="kanban-card-tags">
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <span className="kanban-tag" style={{ background: 'var(--primary)', color: 'white' }}>{task.tag}</span>
                    <span className="kanban-tag" style={{ background: 'var(--border-color)', color: 'var(--text-main)' }}>{task.type || 'Tarea'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {isDone && (
                      <button
                        className="btn-undo-task"
                        title="Deshacer / Mover a En progreso"
                        onClick={() => updateTaskStatus(task.id, 'in-progress').then(() => showToast('Tarea devuelta a progreso.', '🔄'))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          transition: '0.2s',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(14, 165, 233, 0.1)';
                          e.currentTarget.style.color = 'var(--primary)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {!isDone && (
                      <button
                        className="btn-complete-task"
                        title="Marcar como completada"
                        onClick={() => updateTaskStatus(task.id, 'done').then(() => showToast('Tarea completada.', '✅'))}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    {!isDone && (
                      <button
                        className="btn-edit-task"
                        onClick={() => handleEditTaskClick(task)}
                        title={(!task.deadline || task.tag === 'General' || task.status === 'inbox') ? 'Tarea con datos incompletos - no sera planificada por la IA' : 'Editar tarea'}
                        style={{ color: (!task.deadline || task.tag === 'General' || task.status === 'inbox') ? '#fbbf24' : undefined }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button className="btn-delete-task" onClick={() => handleDeleteTask(task.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <p style={{ fontWeight: 600, margin: '8px 0' }}>{task.title}</p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {task.deadline ? (
                    <span>📅 {formatDeadlineSafely(task.deadline)}</span>
                  ) : <span>Sin fecha</span>}
                  {task.estimatedTime && (
                    <span>
                      <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                      {task.estimatedTime}h
                    </span>
                  )}
                </div>

                <div className="mobile-move-actions">
                  {isDone ? (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in-progress').then(() => showToast('Tarea devuelta a progreso.', '🔄'))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%'
                      }}
                    >
                      <RotateCcw size={14} /> Deshacer
                    </button>
                  ) : (
                    <>
                      {getPrevStatus(task.status) && (
                        <button
                          onClick={() => moveTask(task.id, getPrevStatus(task.status))}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <ArrowUp size={14} /> Mover Arriba
                        </button>
                      )}
                      {getNextStatus(task.status) && (
                        <button
                          onClick={() => moveTask(task.id, getNextStatus(task.status))}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          Mover Abajo <ArrowDown size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className="main-content">
      <header className="kanban-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '35px' }}>
        <div>
          <h1 className="page-title">Gestor de Evaluaciones</h1>
          <p className="subtitle">Planifica tus entregas y exámenes con IA</p>
          {/* Resumen de estado de tareas */}
          {tasks.length > 0 && (
            <div className="tasks-summary-bar">
              {overdueTasks.length > 0 && (
                <span className="summary-item overdue">
                  🔴 {overdueTasks.length} vencida{overdueTasks.length !== 1 ? 's' : ''}
                </span>
              )}
              <span className="summary-item pending">
                📋 {pendingTasks.length} pendiente{pendingTasks.length !== 1 ? 's' : ''}
              </span>
              <span className="summary-item done">
                ✅ {doneTasks.length} completada{doneTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center' }}>
            <Plus size={18} style={{ marginRight: '5px' }} /> Nueva Evaluación
          </button>
        </div>
      </header>

      {(() => {
        const incomplete = tasks.filter(t =>
          t.status !== 'done' &&
          t.status !== 'inbox' &&
          (!t.deadline || t.tag === 'General')
        );
        if (incomplete.length === 0) return null;
        return (
          <div className="optimization-banner">
            Tienes {incomplete.length} tarea{incomplete.length !== 1 ? 's' : ''} con datos incompletos.
            Para que el Asistente de IA las asigne automaticamente en tu agenda semanal,
            asegurate de editar la tarjeta, asignar una asignatura especifica y definir
            una fecha de entrega formal.
          </div>
        );
      })()}

      <div className="tareas-split-container">
        {/* Mitad Superior: Kanban Board */}
        <div className="kanban-board-half">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '30vh', gap: '20px', color: 'var(--text-muted)' }}>
              <Loader size={48} className="lucide-spin" />
              <p>Sincronizando tareas desde la nube...</p>
            </div>
          ) : (
            <div className="kanban-board">
              {renderColumn('Bandeja de Entrada', 'inbox', '📥')}
              {renderColumn('Por hacer', 'todo', '📝')}
              {renderColumn('En progreso', 'in-progress', '⏳')}
              {renderColumn('Terminado', 'done', '✅')}
            </div>
          )}
        </div>

        {/* Mitad Inferior: IA Study Planner Schedule */}
        <div className="study-planner-half">
          <div className="study-planner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3><Calendar size={22} color="var(--primary)" /> Planificación de Estudio IA (Ventanas Libres)</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {studyBlocks && studyBlocks.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={clearStudyBlocks}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--text-muted)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Limpiar Planificación
                </button>
              )}
              {previousStudyBlocks !== null && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    restoreStudyBlocks(previousStudyBlocks);
                    setPreviousStudyBlocks(null);
                    showToast('Plan revertido al estado anterior.', 'test');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fbbf24', background: 'rgba(251,191,36,0.08)', color: '#fbbf24', cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Deshacer Cambios
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  setPreviousStudyBlocks(studyBlocks ? [...studyBlocks] : []);
                  generateStudyRoutine(
                    tasks.filter(t =>
                      t.status !== 'done' &&
                      t.status !== 'inbox' &&
                      t.tag !== 'General' &&
                      t.deadline && t.deadline !== ''
                    ),
                    true
                  );
                }}
                disabled={isProcessing}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {isProcessing ? 'Planificando...' : 'Re-generar Estudio IA'}
              </button>
            </div>
          </div>

          <div className="timetable-container study-planner-grid">
            <div className="time-column">
              <div className="time-header">HORAS</div>
              {predefBlocks && predefBlocks.map((b) => (
                <div key={b.index} className="time-slot" style={{ fontSize: '0.7rem', padding: '0 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {b.start} - {b.end}
                </div>
              ))}
            </div>

            <div className="days-container">
              <div className="days-header">
                <div>LUNES</div><div>MARTES</div><div>MIÉRCOLES</div><div>JUEVES</div><div>VIERNES</div><div>SÁBADO</div><div>DOMINGO</div>
              </div>
              <div className="grid-content" style={{ position: 'relative' }}>
                {isProcessing && (
                  <div className="processing-overlay">
                    <Loader size={40} className="spinner" />
                    <p>La IA está planificando tus bloques de estudio en tus ventanas...</p>
                  </div>
                )}

                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                  <div 
                    key={dayIndex} 
                    className="day-track"
                    onDragOver={(e) => handleDragOverTrack(e, dayIndex)}
                    onDragLeave={() => { setHoveredDay(null); setHoveredSlot(null); }}
                    onDrop={(e) => {
                      setHoveredDay(null);
                      setHoveredSlot(null);
                      setDraggedStudyBlockId(null);
                      handleScheduleCardDrop(e, dayIndex);
                    }}
                  >
                    {effectiveSchedule && effectiveSchedule
                      .filter(cls => cls.day === dayIndex)
                      .map(cls => (
                        <div
                          key={cls.id}
                          className={`card ${cls.type} ${cls.isSuspended ? 'suspended' : ''}`}
                          style={{
                            top: cls.top,
                            height: cls.height,
                            opacity: cls.isSuspended ? 0.18 : 0.35,
                            cursor: 'default',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            textAlign: 'center'
                          }}
                        >
                          <span style={{ textDecoration: cls.isSuspended ? 'line-through' : 'none' }}>{cls.title}</span>
                          <span style={{ fontSize: '0.75rem', textDecoration: cls.isSuspended ? 'line-through' : 'none' }}>{cls.room || ''}</span>
                          {cls.isSuspended && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 4px', borderRadius: '4px', marginTop: '2px' }}>
                              🚫 Suspendida
                            </span>
                          )}
                        </div>
                      ))}
                    {studyBlocks && studyBlocks
                      .filter(cls => cls.day === dayIndex)
                      .map(cls => (
                        <div
                          key={cls.id}
                          className="card"
                          draggable
                          onDragStart={(e) => handleScheduleCardDragStart(e, cls.id, 'study')}
                          onDragEnd={() => {
                            setDraggedStudyBlockId(null);
                            setHoveredDay(null);
                            setHoveredSlot(null);
                          }}
                          onClick={() => handleEditStudyBlockClick(cls)}
                          style={{
                            position: 'absolute',
                            top: cls.top,
                            height: cls.height,
                            background: 'repeating-linear-gradient(45deg, var(--primary-light), var(--primary-light) 10px, transparent 10px, transparent 20px)',
                            border: '2px dashed var(--primary)',
                            color: 'var(--primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            textAlign: 'center',
                            opacity: draggedStudyBlockId === cls.id ? 0.4 : 0.95,
                            zIndex: 2,
                            cursor: 'pointer'
                          }}
                          title={`Motivo: ${cls.reason}. Haz clic para editar manualmente.`}
                        >
                          <strong>📚 {cls.title}</strong>
                          <span style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>Bloque de estudio</span>
                        </div>
                      ))}

                    {/* Vista previa y horario flotante al arrastrar */}
                    {draggedStudyBlockId && hoveredDay === dayIndex && hoveredSlot !== null && (() => {
                      const draggedCard = studyBlocks.find(c => c.id === draggedStudyBlockId);
                      if (!draggedCard) return null;
                      
                      const slotSpan = Math.round(draggedCard.height / 50) || 1;
                      const startIdx = hoveredSlot;
                      const endIdx = Math.min(hoveredSlot + slotSpan - 1, predefBlocks.length - 1);
                      const startBlock = predefBlocks[startIdx];
                      const endBlock = predefBlocks[endIdx];
                      if (!startBlock || !endBlock) return null;
                      
                      const bStart = Number(startBlock.startH) * 60 + Number(startBlock.startM);
                      const bEnd = Number(endBlock.endH) * 60 + Number(endBlock.endM);

                      const conflictingClass = (effectiveSchedule || []).find(cls => {
                        if (Number(cls.day) !== Number(dayIndex) || cls.isSuspended) return false;
                        const clsStart = Number(cls.startH) * 60 + Number(cls.startM);
                        const clsEnd = Number(cls.endH) * 60 + Number(cls.endM);
                        return Math.max(bStart, clsStart) < Math.min(bEnd, clsEnd);
                      });

                      const conflictingStudy = studyBlocks.find(sb => {
                        if (String(sb.id) === String(draggedStudyBlockId) || Number(sb.day) !== Number(dayIndex)) return false;
                        const sbStart = Number(sb.startH) * 60 + Number(sb.startM);
                        const sbEnd = Number(sb.endH) * 60 + Number(sb.endM);
                        return Math.max(bStart, sbStart) < Math.min(bEnd, sbEnd);
                      });

                      const isForbidden = !!conflictingClass || !!conflictingStudy;

                      const startTime = startBlock.start;
                      const endTime = endBlock.end;

                      let previewTop = startIdx * 50;
                      let previewHeight = slotSpan * 50;
                      if (conflictingClass) {
                        previewTop = conflictingClass.top;
                        previewHeight = conflictingClass.height;
                      } else if (conflictingStudy) {
                        previewTop = conflictingStudy.top;
                        previewHeight = conflictingStudy.height;
                      }

                      if (isForbidden) {
                        return (
                          <div
                            className="card study-preview-placeholder forbidden"
                            style={{
                              position: 'absolute',
                              top: previewTop,
                              height: previewHeight,
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '2px dashed #ef4444',
                              color: '#ef4444',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              textAlign: 'center',
                              opacity: 0.8,
                              zIndex: 10,
                              pointerEvents: 'none',
                              overflow: 'visible'
                            }}
                          >
                            <Ban size={28} color="#ef4444" />
                          </div>
                        );
                      }
                      
                      return (
                        <div
                          className="card study-preview-placeholder"
                          style={{
                            position: 'absolute',
                            top: startIdx * 50,
                            height: slotSpan * 50,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '2px dashed #10b981',
                            color: '#10b981',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            textAlign: 'center',
                            opacity: 0.8,
                            zIndex: 10,
                            pointerEvents: 'none',
                            overflow: 'visible'
                          }}
                        >
                          <strong>📚 {draggedCard.title}</strong>
                          <span style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>Bloque de estudio</span>
                          
                          {/* Horario flotante sobre la ficha de bloque de estudio */}
                          <div style={{
                            position: 'absolute',
                            top: '-32px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#10b981',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            whiteSpace: 'nowrap',
                            zIndex: 100
                          }}>
                            {startTime} - {endTime}
                            <div style={{
                              position: 'absolute',
                              bottom: '-4px',
                              left: '50%',
                              transform: 'translateX(-50%) rotate(45deg)',
                              width: '8px',
                              height: '8px',
                              background: '#10b981'
                            }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}

                {!effectiveSchedule && !isProcessing && (
                  <div className="empty-schedule" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', zIndex: 10 }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: '750', color: 'var(--text-main)' }}>Sube tu horario en la sección "Mi Horario" para planificar automáticamente tus estudios.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="premium-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              <Sparkles size={24} color="var(--primary)" /> Añadir Nueva Evaluación
            </h3>
            <form onSubmit={handleModalSubmit}>
              <div className="form-group-premium">
                <label>Título / Nombre</label>
                <div className="premium-input-wrapper">
                  <AlignLeft size={18} className="input-icon" />
                  <input required type="text" className="premium-input" value={newTaskData.title} onChange={e => setNewTaskData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ej: Prueba Cálculo III" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Asignatura</label>
                  <div className="premium-input-wrapper">
                    <BookOpen size={18} className="input-icon" />
                    <select
                      className="premium-input"
                      value={newTaskData.tag}
                      onChange={e => setNewTaskData(prev => ({ ...prev, tag: e.target.value }))}
                    >
                      <option value="General">General</option>
                      {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <div className="premium-input-wrapper">
                    <Tag size={18} className="input-icon" />
                    <select className="premium-input" value={newTaskData.type} onChange={e => setNewTaskData(prev => ({ ...prev, type: e.target.value }))}>
                      <option value="Prueba">Prueba</option>
                      <option value="Examen">Examen</option>
                      <option value="Proyecto">Proyecto</option>
                      <option value="Exposición">Exposición</option>
                      <option value="Tarea">Tarea</option>
                      <option value="Lectura">Lectura</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Fecha de Entrega</label>
                  <div className="premium-input-wrapper">
                    <Calendar size={18} className="input-icon" />
                    <input required type="date" className="premium-input" value={newTaskData.deadline} onChange={e => setNewTaskData(prev => ({ ...prev, deadline: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Estudio (Horas)</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input required type="number" min="1" max="24" className="premium-input" value={newTaskData.estimatedTime} onChange={e => setNewTaskData(prev => ({ ...prev, estimatedTime: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-submit-premium"><Plus size={18} /> Guardar Evaluación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}>
          <div className="premium-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              <Sparkles size={24} color="var(--primary)" /> Editar Detalles de la Tarea
            </h3>
            <form onSubmit={handleEditModalSubmit}>
              <div className="form-group-premium">
                <label>Título / Nombre</label>
                <div className="premium-input-wrapper">
                  <AlignLeft size={18} className="input-icon" />
                  <input required type="text" className="premium-input" value={editTaskData.title} onChange={e => setEditTaskData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ej: Resolver guía de ejercicios" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Asignatura</label>
                  <div className="premium-input-wrapper">
                    <BookOpen size={18} className="input-icon" />
                    <select
                      className="premium-input"
                      value={editTaskData.tag}
                      onChange={e => setEditTaskData(prev => ({ ...prev, tag: e.target.value }))}
                    >
                      <option value="General">General</option>
                      {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <div className="premium-input-wrapper">
                    <Tag size={18} className="input-icon" />
                    <select className="premium-input" value={editTaskData.type} onChange={e => setEditTaskData(prev => ({ ...prev, type: e.target.value }))}>
                      <option value="Prueba">Prueba</option>
                      <option value="Examen">Examen</option>
                      <option value="Proyecto">Proyecto</option>
                      <option value="Exposición">Exposición</option>
                      <option value="Tarea">Tarea</option>
                      <option value="Lectura">Lectura</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Fecha de Entrega</label>
                  <div className="premium-input-wrapper">
                    <Calendar size={18} className="input-icon" />
                    <input required type="date" className="premium-input" value={editTaskData.deadline} onChange={e => setEditTaskData(prev => ({ ...prev, deadline: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Estudio (Horas)</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input required type="number" min="1" max="24" className="premium-input" value={editTaskData.estimatedTime} onChange={e => setEditTaskData(prev => ({ ...prev, estimatedTime: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}>Cancelar</button>
                <button type="submit" className="btn-submit-premium"><Plus size={18} /> Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingStudyBlock && (
        <div className="modal-overlay" onClick={() => setEditingStudyBlock(null)}>
          <div className="premium-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              <Clock size={24} color="var(--primary)" /> Editar Horario de Bloque de Estudio
            </h3>
            <form onSubmit={handleEditStudyBlockSubmit}>
              <div className="form-group-premium">
                <label>Día de la Semana</label>
                <div className="premium-input-wrapper">
                  <Calendar size={18} className="input-icon" />
                  <select 
                    className="premium-input" 
                    value={editStudyBlockData.day} 
                    onChange={e => setEditStudyBlockData(prev => ({ ...prev, day: Number(e.target.value) }))}
                  >
                    <option value={0}>Lunes</option>
                    <option value={1}>Martes</option>
                    <option value={2}>Miércoles</option>
                    <option value={3}>Jueves</option>
                    <option value={4}>Viernes</option>
                    <option value={5}>Sábado</option>
                    <option value={6}>Domingo</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Hora de Inicio</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input 
                      type="time" 
                      required 
                      className="premium-input" 
                      value={editStudyBlockData.startTime} 
                      onChange={e => setEditStudyBlockData(prev => ({ ...prev, startTime: e.target.value }))} 
                    />
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Hora de Fin</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input 
                      type="time" 
                      required 
                      className="premium-input" 
                      value={editStudyBlockData.endTime} 
                      onChange={e => setEditStudyBlockData(prev => ({ ...prev, endTime: e.target.value }))} 
                    />
                  </div>
                </div>
              </div>

              <div className="premium-actions study-block-actions">
                <button type="button" className="btn-danger" onClick={handleDeleteStudyBlock}>
                  <Trash2 size={16} /> Eliminar Bloque
                </button>
                <div className="actions-right">
                  <button type="button" className="btn-cancel-premium" onClick={() => setEditingStudyBlock(null)}>Cancelar</button>
                  <button type="submit" className="btn-submit-premium"><Check size={18} /> Guardar Horario</button>
                </div>
              </div>
            </form>
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
    </main>
  );
}
