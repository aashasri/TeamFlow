import React, { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { formatDate } from '../../../lib/dateUtils';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const CONTENT_COLORS = { 'Static post': '#7c3aed', Photo: '#0ea5e9', Reel: '#ec4899', Carousel: '#f59e0b' };
const STATUS_CHIP = { Published: { bg: '#10b98133', color: '#10b981' }, Scheduled: { bg: '#f59e0b33', color: '#f59e0b' }, Draft: { bg: '#8890b022', color: '#8890b0' } };
const PLATFORM_FILTERS = ['All','Instagram','Facebook','X','TikTok','GMB','Pinterest'];

const CalendarGrid = ({ managerView = false }) => {
  const { data, saveCalendarNote, deleteTask, deleteSocialPost } = useData();
  const { user } = useAuth();
  const today = new Date();
  const [currMonth, setCurrMonth] = useState(today.getMonth());
  const [currYear,  setCurrYear]  = useState(today.getFullYear());
  const [platformFilter, setPlatformFilter] = useState('All');

  const changeMonth = (dir) => {
    let nm = currMonth + dir, ny = currYear;
    if (nm > 11) { nm = 0; ny++; } else if (nm < 0) { nm = 11; ny--; }
    setCurrMonth(nm); setCurrYear(ny);
  };

  const firstDay    = new Date(currYear, currMonth, 1).getDay();
  const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
  const prevDays    = new Date(currYear, currMonth, 0).getDate();

  // Tasks for this month
  const monthTasks = data.tasks.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline + 'T00:00:00');
    return d.getMonth() === currMonth && d.getFullYear() === currYear && (managerView || t.assignedTo === user?.userId);
  });

  // Social posts for this month (shown as colored chips)
  const monthPosts = (data.socialPosts || []).filter(p => {
    const dateStr = p.publishDate || p.submissionDate || '';
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    if (d.getMonth() !== currMonth || d.getFullYear() !== currYear) return false;
    if (platformFilter !== 'All') {
      // Check content type or platform fields
      const postPlatforms = p.links ? Object.keys(p.links).filter(k => p.links[k]) : [];
      if (!postPlatforms.some(pp => pp.toLowerCase() === platformFilter.toLowerCase())) {
        // Also check if contentType matches (as a fallback)
        return false;
      }
    }
    return true;
  });

  const fmtDate = (d) => `${currYear}-${String(currMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const tasksForDay = (d) => monthTasks.filter(t => t.deadline === fmtDate(d));
  const postsForDay = (d) => monthPosts.filter(p => (p.publishDate || p.submissionDate) === fmtDate(d));

  const getNote = (dk) => (data.calendarNotes[user?.userId]?.[dk]) || '';

  // All month sidebar tasks
  const allSideItems = [
    ...monthTasks.map(t => ({ ...t, itemType: 'task' })),
    ...monthPosts.map(p => ({ ...p, itemType: 'post', deadline: p.publishDate || p.submissionDate })),
  ].sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

  // Render cells
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`p${i}`} className="planner-day other-month"><span className="planner-day-num muted">{prevDays - (firstDay - i - 1)}</span></div>);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getDate() === d && today.getMonth() === currMonth && today.getFullYear() === currYear;
    const dk = fmtDate(d);
    const tasks = tasksForDay(d);
    const posts = postsForDay(d);
    const note  = getNote(dk);
    cells.push(
      <div key={d} className={`planner-day ${isToday ? 'planner-today' : ''}`}>
        <span className={`planner-day-num ${isToday ? 'day-today-badge' : ''}`}>{d}</span>
        <div className="planner-tasks">
          {/* Task pills */}
          {tasks.slice(0, 1).map(t => (
            <div key={t.id} className="planner-pill"
              style={{ background: t.status === 'done' ? '#10b98133' : '#7c3aed33', color: t.status === 'done' ? '#10b981' : '#a78bfa', borderLeft: `2px solid ${t.status === 'done' ? '#10b981' : '#7c3aed'}` }}>
              {t.title.length > 10 ? t.title.slice(0,10) + '…' : t.title}
            </div>
          ))}
          {/* Social post chips */}
          {posts.slice(0, 2).map(p => (
            <div key={p.id} title={`${p.contentType}: ${p.contentTheme}`}
              style={{
                fontSize: 9, padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                background: (CONTENT_COLORS[p.contentType] || '#7c3aed') + '33',
                color: CONTENT_COLORS[p.contentType] || '#7c3aed',
                borderLeft: `2px solid ${CONTENT_COLORS[p.contentType] || '#7c3aed'}`,
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                opacity: p.status === 'Published' ? 1 : 0.7,
              }}>
              {p.status === 'Published' ? '✓' : '⏰'} {(p.contentTheme || p.caption || '').slice(0, 8)}
            </div>
          ))}
          {(tasks.length + posts.length) > 3 && <div style={{ fontSize: 8, color: '#8890b0' }}>+{tasks.length + posts.length - 3} more</div>}
        </div>
        <input className="planner-note-input" placeholder="Note…" value={note}
          onChange={e => saveCalendarNote(user?.userId, dk, e.target.value)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
      {/* Calendar */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Monthly Planner</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px' }} onClick={() => changeMonth(-1)}>← Prev</button>
            <select value={currMonth} onChange={e => setCurrMonth(Number(e.target.value))}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              {MONTHS.map((m, i) => <option key={m} value={i} style={{ color: '#000' }}>{m}</option>)}
            </select>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px' }} onClick={() => changeMonth(1)}>Next →</button>
          </div>
        </div>

        {/* Platform filter chips */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          {PLATFORM_FILTERS.map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: platformFilter === p ? '#7c3aed' : 'rgba(255,255,255,0.06)', color: platformFilter === p ? '#fff' : '#8890b0' }}>
              {p}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: '0.68rem', color: '#8890b0', flexWrap: 'wrap' }}>
          {Object.entries(CONTENT_COLORS).map(([k, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{k}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', color: '#10b981' }}>✓ Posted</span>
          <span style={{ color: '#f59e0b' }}>⏰ Scheduled</span>
        </div>

        <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 10 }}>{MONTHS[currMonth]} {currYear}</h3>

        <div className="planner-grid">
          {DAYS.map(d => <div key={d} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8890b0', textAlign: 'center', paddingBottom: 6 }}>{d}</div>)}
          {cells}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="card" style={{ padding: 16, maxHeight: 620, overflowY: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 14 }}>This Month</div>
        {allSideItems.length === 0 ? (
          <div style={{ color: '#8890b0', fontSize: '0.8rem', textAlign: 'center', paddingTop: 30 }}>Nothing this month</div>
        ) : (
          allSideItems.map(item => {
            if (item.itemType === 'task') {
              const sc = STATUS_CHIP[item.status === 'done' ? 'Published' : item.status === 'inprogress' ? 'Scheduled' : 'Draft'] || STATUS_CHIP.Draft;
              return (
                <div key={'t'+item.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>📋 {item.title}</div>
                    <div style={{ fontSize: '0.68rem', color: '#8890b0' }}>{item.assignedName} · {formatDate(item.deadline)}</div>
                  </div>
                  {managerView && (
                    <button onClick={() => { if(window.confirm('Delete this task?')) deleteTask?.(item.id) }} 
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem', padding: '2px 4px' }} title="Delete Plan">✕</button>
                  )}
                </div>
              );
            }
            // Social post
            const cc = CONTENT_COLORS[item.contentType] || '#7c3aed';
            const sc = STATUS_CHIP[item.status] || STATUS_CHIP.Draft;
            return (
              <div key={'p'+item.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid var(--border)', borderLeft: `3px solid ${cc}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>📱 {item.contentTheme || item.caption}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ background: cc + '22', color: cc, padding: '1px 6px', borderRadius: 99, fontSize: '0.62rem', fontWeight: 700 }}>{item.contentType}</span>
                    <span style={{ background: sc.bg, color: sc.color, padding: '1px 6px', borderRadius: 99, fontSize: '0.62rem', fontWeight: 700 }}>{item.status}</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#8890b0', marginTop: 3 }}>{formatDate(item.publishDate)} · {item.publishTime}</div>
                </div>
                {managerView && (
                  <button onClick={() => { if(window.confirm('Delete this social post plan?')) deleteSocialPost?.(item.id) }} 
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem', padding: '2px 4px', flexShrink: 0 }} title="Delete Plan">✕</button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CalendarGrid;
