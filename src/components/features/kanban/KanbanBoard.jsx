import React from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { pushNotif } from '../../../lib/notifications';

const KanbanBoard = ({ tasks, onTaskClick, viewFilter = 'all' }) => {
  const { updateTask } = useData();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  const [submittingId, setSubmittingId] = React.useState(null);
  const [tempLink, setTempLink] = React.useState('');

  const columns = [
    { id: 'todo', label: 'To Do', icon: '📝' },
    { id: 'inprogress', label: 'In Progress', icon: '⚡' },
    { id: 'review', label: 'Awaiting Review', icon: '🔍' },
    { id: 'done', label: 'Completed', icon: '✅' }
  ];

  const handleQuickSubmit = async (e, taskId, title) => {
    e.stopPropagation();
    if (!tempLink.trim()) return setSubmittingId(null);
    const { error } = await updateTask(taskId, { link: tempLink });
    if (!error) {
      pushNotif({ title: '✅ Link Saved', body: `Result for "${title}" has been submitted.`, icon: '🔗' });
      setSubmittingId(null);
      setTempLink('');
    } else {
      alert('Failed to save link: ' + error.message);
    }
  };

  return (
    <div className="kanban">
      {columns.map(col => {
        if (viewFilter !== 'all' && viewFilter !== col.id) return null;
        
        const colTasks = tasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} className="kanban-col">
            <div className="kanban-col-title">
              <span>{col.icon} {col.label}</span>
              <span className="kanban-count">{colTasks.length}</span>
            </div>
            {colTasks.map(task => (
              <div key={task.id} className="task-card" onClick={() => onTaskClick(task)}>
                <div className="tc-title">
                  {task.title}
                  {task.selfAssigned && <span style={{ marginLeft: 6, fontSize: '0.6rem', padding: '2px 7px', borderRadius: 99, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', fontWeight: 700 }}>Self Task</span>}
                </div>
                <div className="tc-meta">
                  <span className={`badge ${task.priority === 'high' ? 'btn-red' : (task.priority === 'medium' ? 'btn-amber' : 'btn-ghost')}`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-muted">{task.dept}</span>
                </div>
                
                {submittingId === task.id ? (
                  <div className="mt10" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                    <input autoFocus className="tf-input" placeholder="Paste link..." 
                      value={tempLink} onChange={e => setTempLink(e.target.value)}
                      style={{ fontSize: '0.72rem', height: 26, padding: '0 8px' }} />
                    <button className="btn" onClick={(e) => handleQuickSubmit(e, task.id, task.title)} 
                      style={{ height: 26, padding: '0 8px', fontSize: '0.7rem', background: '#10b981' }}>Save</button>
                  </div>
                ) : (
                  <>
                    {(isEmployee && (task.status === 'inprogress' || task.status === 'done')) && (
                      <button className="btn-ghost mt10" onClick={(e) => { e.stopPropagation(); setSubmittingId(task.id); setTempLink(task.link || ''); }}
                        style={{ fontSize: '0.7rem', padding: '4px 8px', border: '1px dashed rgba(255,255,255,0.2)', width: '100%', borderRadius: 6, color: '#a78bfa' }}>
                        {task.link ? '🔗 Update Link' : '＋ Submit Link'}
                      </button>
                    )}
                  </>
                )}

                {task.loggedSeconds > 0 && !submittingId && (
                  <div className="tc-time" style={{ marginTop: 8 }}>
                    ⏱️ {Math.floor(task.loggedSeconds / 3600)}h {Math.floor((task.loggedSeconds % 3600) / 60)}m
                  </div>
                )}
                <div className="tc-deadline">📅 {task.deadline}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
