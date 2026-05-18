import { useState } from 'react';
import { Plus, GripVertical, Trash2, Loader } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';

export default function Tareas() {
  const { schedule } = useSchedule();
  const { tasks, isLoading, addTask, updateTaskStatus, deleteTask, deleteMultipleTasks } = useTasks();
  
  const uniqueSubjects = schedule ? Array.from(new Set(schedule.map(c => c.title))) : [];

  const [newTasks, setNewTasks] = useState({ todo: '', 'in-progress': '', done: '' });
  const [newTasksTags, setNewTasksTags] = useState({ todo: 'General', 'in-progress': 'General', done: 'General' });
  const [newTasksPriority, setNewTasksPriority] = useState({ todo: 'low', 'in-progress': 'low', done: 'low' });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);

  const showToast = (message) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleInputChange = (status, value) => {
    setNewTasks(prev => ({ ...prev, [status]: value }));
  };

  const handleAddTask = async (e, status) => {
    e.preventDefault();
    if (!newTasks[status]?.trim()) return;
    
    await addTask(newTasks[status], status, newTasksTags[status], newTasksPriority[status]);
    setNewTasks(prev => ({ ...prev, [status]: '' }));
    setNewTasksPriority(prev => ({ ...prev, [status]: 'low' }));
  };

  const handleDeleteTask = async (id) => {
    const success = await deleteTask(id);
    if (success) {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast('Se eliminó 1 tarea.');
    } else {
      showToast('Error al eliminar la tarea.');
    }
  };

  const toggleSelection = (id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedTasks = async () => {
    const count = selectedTaskIds.size;
    const taskIdsArray = Array.from(selectedTaskIds);
    const success = await deleteMultipleTasks(taskIdsArray);
    if (success) {
      setSelectedTaskIds(new Set());
      showToast(`Se eliminaron ${count} tarea${count > 1 ? 's' : ''}.`);
    } else {
      showToast('Error al eliminar las tareas.');
    }
  };

  const handleDragStart = (e, id) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      e.target.classList.add('is-dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('is-dragging');
    setDraggedTaskId(null);
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

  const moveTask = async (id, newStatus) => {
    if (!newStatus) return;
    await updateTaskStatus(id, newStatus);
  };

  const getPrevStatus = (status) => {
    if (status === 'in-progress') return 'todo';
    if (status === 'done') return 'in-progress';
    return null;
  };

  const getNextStatus = (status) => {
    if (status === 'todo') return 'in-progress';
    if (status === 'in-progress') return 'done';
    return null;
  };

  const getTasksByStatus = (status) => tasks.filter(t => t.status === status);

  const statusMap = {
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
        {getTasksByStatus(status).map(task => (
          <div 
            key={task.id} 
            className={`kanban-card ${selectedTaskIds.has(task.id) ? 'selected' : ''}`}
            draggable
            data-id={task.id}
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragEnd={handleDragEnd}
          >
            <div className="kanban-card-drag-handle">
              <GripVertical size={16} color="var(--text-muted)" />
            </div>
            
            <div className="kanban-card-checkbox">
              <input 
                type="checkbox" 
                checked={selectedTaskIds.has(task.id)}
                onChange={() => toggleSelection(task.id)}
              />
            </div>

            <div className="kanban-card-content">
              <div className="kanban-card-tags">
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <span className={`kanban-tag ${task.priority}`}>{task.tag}</span>
                  <span className="kanban-tag" style={{ background: 'var(--border-color)', color: 'var(--text-main)' }}>{statusMap[task.status]}</span>
                </div>
                <button className="btn-delete-task" onClick={() => handleDeleteTask(task.id)}><Trash2 size={14}/></button>
              </div>
              <p>{task.title}</p>
              
              <div className="mobile-move-actions">
                {getPrevStatus(task.status) && (
                  <button onClick={() => moveTask(task.id, getPrevStatus(task.status))}>
                    &larr; Mover
                  </button>
                )}
                {getNextStatus(task.status) && (
                  <button onClick={() => moveTask(task.id, getNextStatus(task.status))}>
                    Mover &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className="kanban-add-task-form" onSubmit={(e) => handleAddTask(e, status)} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <select 
          className="kanban-select"
          style={{ width: '80px', padding: '5px', fontSize: '0.8rem' }}
          value={newTasksTags[status]} 
          onChange={(e) => setNewTasksTags(prev => ({ ...prev, [status]: e.target.value }))}
        >
          <option value="General">General</option>
          {uniqueSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
        </select>
        
        <select 
          className="kanban-select"
          style={{ width: '80px', padding: '5px', fontSize: '0.8rem', color: newTasksPriority[status] === 'high' ? '#ef4444' : 'inherit' }}
          value={newTasksPriority[status]} 
          onChange={(e) => setNewTasksPriority(prev => ({ ...prev, [status]: e.target.value }))}
        >
          <option value="low">Normal</option>
          <option value="high">Urgente 🔥</option>
        </select>

        <input 
          className="kanban-input-inline"
          type="text" 
          placeholder="Añadir tarea..." 
          value={newTasks[status]}
          onChange={(e) => handleInputChange(status, e.target.value)}
          onMouseEnter={(e) => e.target.focus()}
          onMouseLeave={(e) => e.target.blur()}
          onFocus={(e) => e.target.placeholder = ''}
          onBlur={(e) => e.target.placeholder = 'Añadir tarea...'}
        />
        <button type="submit" className="btn-primary btn-add-inline" disabled={!newTasks[status]?.trim()}>
          <Plus size={16} />
        </button>
      </form>
    </div>
  );

  return (
    <main className="main-content">
      <header className="kanban-header">
        <div>
          <h1>Gestor de Tareas</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Organiza tu flujo de estudio con metodología Kanban en la Nube</p>
        </div>
        {selectedTaskIds.size > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">
              {selectedTaskIds.size === 1 
                ? '1 tarea seleccionada' 
                : `${selectedTaskIds.size} tareas seleccionadas`}
            </span>
            <button className="btn-danger" onClick={handleDeleteSelectedTasks}>
              <Trash2 size={18} /> Eliminar
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px', color: 'var(--text-muted)'}}>
          <Loader size={48} className="lucide-spin" />
          <p>Sincronizando tareas desde la nube...</p>
        </div>
      ) : (
        <div className="kanban-board">
          {renderColumn('Por hacer', 'todo', '📝')}
          {renderColumn('En progreso', 'in-progress', '⏳')}
          {renderColumn('Terminado', 'done', '✅')}
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className="toast-notification">
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
