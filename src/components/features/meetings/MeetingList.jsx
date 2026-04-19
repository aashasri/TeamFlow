import React, { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { meetingLimiter } from '../../../lib/rateLimiter';
import { validateMeetingForm } from '../../../lib/validators';
import { formatDate, formatDateTime } from '../../../lib/dateUtils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MeetingList = () => {
  const { data, addMeeting, cancelMeeting, addMeetingNote, deleteMeetingNote } = useData();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [showForm, setShowForm] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '', type: 'internal', clientId: '', attendees: [], link: '', desc: '' });

  // Meeting notes state
  const [noteText, setNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const employees = data.users.filter(u => u.role === 'employee');
  const clients   = data.clients;
  const now = new Date();
  const sortMeetings = (arr) => {
    const upcoming = arr.filter(m => new Date(m.date + 'T23:59:59') >= now).sort((a, b) => a.date.localeCompare(b.date));
    const past = arr.filter(m => new Date(m.date + 'T23:59:59') < now).sort((a, b) => b.date.localeCompare(a.date));
    return [...upcoming, ...past];
  };
  const allMeetings = sortMeetings([...data.meetings]).filter(m => m.status !== 'canceled');
  const myMeetings  = sortMeetings(data.meetings.filter(m => m.attendees.includes(user?.userId))).filter(m => m.status !== 'canceled');
  const meetDisplayList = isManager ? allMeetings : myMeetings;

  // Next upcoming meeting
  const nextMeeting = meetDisplayList.find(m => new Date(m.date + 'T23:59:59') >= now);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };
  const toggleAttendee = (uid) => setForm(f => ({ ...f, attendees: f.attendees.includes(uid) ? f.attendees.filter(id => id !== uid) : [...f.attendees, uid] }));

  const resetForm = () => {
    setForm({ title: '', date: '', time: '', type: 'internal', clientId: '', attendees: [], link: '', desc: '' });
    setErrors({});
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = validateMeetingForm(form);
    
    let apiDate = form.date;
    if (form.date) {
      const parts = form.date.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        apiDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        errs.date = 'Use dd/mm/yyyy format';
      }
    }

    if (form.attendees.length === 0 && isManager) errs.attendees = 'Select at least one attendee';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const rl = meetingLimiter.check(user?.userId);
    if (!rl.allowed) { setErrors({ general: `Rate limit. Wait ${rl.waitSeconds}s.` }); return; }
    setLoading(true);
    const attendees = isManager ? form.attendees : [user.userId, ...form.attendees.filter(id => id !== user.userId)];
    const { error, data: newMeet } = await addMeeting({ ...form, date: apiDate, attendees, createdBy: user?.userId });
    setLoading(false);
    if (error) {
      setErrors({ general: 'Failed to create meeting: ' + (error.message || 'Unknown error') });
      return;
    }
    resetForm();
    setShowForm(false);
  };

  const handleCancel = async (meetingId) => {
    if (window.confirm('Cancel this meeting?')) {
      await cancelMeeting(meetingId);
      if (selectedMeeting?.id === meetingId) setSelectedMeeting(null);
    }
  };

  // Schedule Follow-up: pre-fills the form with data from the selected meeting
  const handleScheduleFollowup = (meeting) => {
    setForm({
      title: `Follow-up: ${meeting.title}`,
      date: '',
      time: meeting.time || '',
      type: meeting.type || 'internal',
      clientId: meeting.clientId || '',
      attendees: [...(meeting.attendees || [])],
      link: '',
      desc: `Follow-up meeting for "${meeting.title}"`,
    });
    setErrors({});
    setShowForm(true);
    setSelectedMeeting(null);
  };

  // Meeting Notes handlers
  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedMeeting) return;
    setNoteSubmitting(true);
    await addMeetingNote(selectedMeeting.id, {
      author: user?.name || 'Unknown',
      authorId: user?.userId,
      content: noteText.trim(),
    });
    setNoteText('');
    setNoteSubmitting(false);
  };

  const handleDeleteNote = async (noteId) => {
    if (!selectedMeeting) return;
    if (window.confirm('Delete this note?')) {
      await deleteMeetingNote(selectedMeeting.id, noteId);
    }
  };

  // Keep selectedMeeting synced with live data or fallback to the new meeting object immediately
  const liveMeeting = selectedMeeting ? (data.meetings.find(m => m.id === selectedMeeting.id) || selectedMeeting) : null;

  /* ═══════════════════════════════════════════════════════
     MEETING DETAIL VIEW
     ═══════════════════════════════════════════════════════ */
  if (liveMeeting) {
    const d = new Date(liveMeeting.date + 'T00:00:00');
    const isPast = d < now && d.toDateString() !== now.toDateString();
    const isCreator = liveMeeting.createdBy === user?.userId || (isManager && !liveMeeting.createdBy);
    const profiles = (liveMeeting.attendees || []).map(id => data.users.find(u => u.id === id)).filter(Boolean);
    const clientInfo = liveMeeting.clientId ? data.clients.find(c => c.id === liveMeeting.clientId) : null;
    const notes = liveMeeting.notes || [];

    return (
      <div className="anim-fade-in">
        {/* Back button */}
        <button className="btn btn-ghost" onClick={() => setSelectedMeeting(null)}
          style={{ marginBottom: 16, fontSize: '0.82rem' }}>← Back to Meetings</button>

        {/* Meeting Header Card */}
        <div className="meet-detail-header">
          <div className="meet-detail-date-badge">
            <div style={{ fontSize: '1.8rem', lineHeight: 1, fontWeight: 900 }}>{d.getDate()}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 600 }}>{MONTHS[d.getMonth()]}</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{d.getFullYear()}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0 }}>{liveMeeting.title}</h2>
              <span className={`meet-badge ${liveMeeting.type === 'client' ? 'meet-badge-blue' : 'meet-badge-purple'}`}>
                {liveMeeting.type === 'client' ? '👔 Client' : '🏢 Internal'}
              </span>
              {isPast && <span className="meet-badge meet-badge-dim">Past</span>}
              {liveMeeting.status === 'canceled' && <span className="meet-badge meet-badge-red">Canceled</span>}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#8890b0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>📅 {formatDate(liveMeeting.date)}</span>
              <span>⏰ {liveMeeting.time}</span>
              <span>👥 {(liveMeeting.attendees || []).length} attendee{(liveMeeting.attendees || []).length !== 1 ? 's' : ''}</span>
              {clientInfo && <span>🏢 {clientInfo.name}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginTop: 20 }}>
          {/* Left Column: Details + Notes */}
          <div>
            {/* Description */}
            {liveMeeting.desc && (
              <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8890b0', marginBottom: 6 }}>📝 Description / Agenda</div>
                <div style={{ fontSize: '0.9rem', color: '#c0c5d8', lineHeight: 1.6 }}>{liveMeeting.desc}</div>
              </div>
            )}

            {/* Meeting Link */}
            {liveMeeting.link && (
              <div className="card" style={{ padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span style={{ fontSize: '1.2rem' }}>🔗</span>
                <a href={liveMeeting.link} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {liveMeeting.link}
                </a>
              </div>
            )}

            {/* ── Meeting Notes (MoM) ── */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>📋 Meeting Notes (MoM)</div>
                <span style={{ fontSize: '0.72rem', color: '#8890b0' }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Add note input */}
              <div className="meet-note-input-wrap">
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: user?.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff', flexShrink: 0, marginTop: 2 }}>
                    {user?.avatar || user?.name?.[0] || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      className="tf-input"
                      rows={2}
                      placeholder="Add a meeting note..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                      style={{ background: '#1a1c2e', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', resize: 'none', padding: 10, width: '100%', boxSizing: 'border-box', fontSize: '0.85rem', borderRadius: 8 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: '0.65rem', color: '#555' }}>Ctrl+Enter to submit</span>
                      <button onClick={handleAddNote} disabled={!noteText.trim() || noteSubmitting}
                        style={{ padding: '6px 16px', borderRadius: 6, background: noteText.trim() ? '#7c3aed' : '#333', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: noteText.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}>
                        {noteSubmitting ? 'Adding…' : '＋ Add Note'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes timeline */}
              {notes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#555', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  No notes yet. Add the first note above.
                </div>
              ) : (
                <div className="meet-notes-timeline">
                  {notes.map((note, idx) => {
                    const isOwn = note.authorId === user?.userId;
                    const noteUser = data.users.find(u => u.id === note.authorId);
                    return (
                      <div key={note.id || idx} className="meet-note-card">
                        <div className="meet-note-dot" />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: noteUser?.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 800, color: '#fff' }}>
                                {noteUser?.avatar || note.author?.[0] || '?'}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fff' }}>{note.author}</span>
                              <span style={{ fontSize: '0.68rem', color: '#555' }}>{formatDateTime(note.timestamp)}</span>
                            </div>
                            {isOwn && (
                              <button onClick={() => handleDeleteNote(note.id)} title="Delete note"
                                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s' }}
                                onMouseEnter={e => e.target.style.color = '#ef4444'}
                                onMouseLeave={e => e.target.style.color = '#555'}>
                                🗑
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.88rem', color: '#c0c5d8', lineHeight: 1.6, paddingLeft: 30 }}>
                            {note.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Attendees + Actions */}
          <div>
            {/* Attendees */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 14 }}>👥 Attendees ({profiles.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {profiles.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#fff' }}>{p.avatar}</div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{p.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#8890b0' }}>{p.dept || p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client info */}
            {clientInfo && (
              <div className="card" style={{ padding: '14px 20px', marginBottom: 16, borderLeft: '3px solid var(--blue)' }}>
                <div style={{ fontSize: '0.72rem', color: '#8890b0', fontWeight: 600 }}>Client</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{clientInfo.name}</div>
                {clientInfo.project && <div style={{ fontSize: '0.78rem', color: '#8890b0' }}>{clientInfo.project}</div>}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleScheduleFollowup(liveMeeting)}
                className="meet-action-btn meet-action-schedule">
                📅 Schedule Follow-up Meeting
              </button>

              {liveMeeting.link && (
                <a href={liveMeeting.link} target="_blank" rel="noopener noreferrer"
                  className="meet-action-btn meet-action-join">
                  🔗 Join Meeting
                </a>
              )}

              {isCreator && !isPast && liveMeeting.status !== 'canceled' && (
                <button onClick={() => handleCancel(liveMeeting.id)}
                  className="meet-action-btn meet-action-cancel">
                  ✕ Cancel Meeting
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MAIN MEETINGS LIST VIEW
     ═══════════════════════════════════════════════════════ */
  const renderMeetingCard = (m) => {
    const d = new Date(m.date + 'T00:00:00');
    const isPast = d < now && d.toDateString() !== now.toDateString();
    const isToday = d.toDateString() === now.toDateString();
    const isCanceled = m.status === 'canceled';
    const profiles = m.attendees.map(id => data.users.find(u => u.id === id)).filter(Boolean);
    const noteCount = (m.notes || []).length;
    return (
      <div key={m.id} className="card" onClick={() => setSelectedMeeting(m)}
        style={{ 
          padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer',
          opacity: (isPast || isCanceled) ? 0.5 : 1, 
          border: isCanceled ? '1px solid #ef4444' : (isToday ? '1px solid #10b981' : '1px solid var(--border)'), 
          boxShadow: isToday && !isCanceled ? '0 0 16px rgba(16,185,129,0.1)' : 'none',
          background: isCanceled ? 'rgba(239,68,68,0.02)' : 'var(--bg2)',
          transition: 'border-color 0.15s, transform 0.1s',
        }}
        onMouseEnter={e => { if (!isCanceled) e.currentTarget.style.borderColor = '#7c3aed55'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isCanceled ? '#ef4444' : (isToday ? '#10b981' : 'var(--border)'); }}
      >
        <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: isCanceled ? '#555' : (m.type === 'client' ? 'var(--blue)' : 'var(--accent)'), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
          <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{d.getDate()}</div>
          <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{MONTHS[d.getMonth()]}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isCanceled ? '#8890b0' : '#fff', textDecoration: isCanceled ? 'line-through' : 'none' }}>{m.title}</div>
            {isToday && !isCanceled && <span style={{ background: '#10b98122', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>TODAY</span>}
            {isCanceled && <span style={{ background: '#ef444422', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>CANCELED</span>}
            {noteCount > 0 && <span style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', padding: '2px 6px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700 }}>📋 {noteCount} note{noteCount !== 1 ? 's' : ''}</span>}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8890b0', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <span>📅 {formatDate(m.date)}</span>
            <span>⏰ {m.time}</span>
            <span>👥 {m.attendees.length}</span>
            <span style={{ color: m.type === 'client' ? 'var(--blue)' : '#555' }}>{m.type === 'client' ? '👔 Client' : '🏢 Internal'}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {profiles.slice(0, 5).map(p => (
              <div key={p.id} title={p.name} style={{ width: 22, height: 22, borderRadius: '50%', background: p.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: '#fff' }}>{p.avatar}</div>
            ))}
            {profiles.length > 5 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1e2035', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#8890b0' }}>+{profiles.length - 5}</div>}
          </div>
        </div>
        {isPast && <span style={{ fontSize: '0.68rem', color: '#555', flexShrink: 0 }}>Past</span>}
      </div>
    );
  };
  return (
    <div>
      {/* ── Upcoming Meeting Banner ── */}
      {nextMeeting && (() => {
        const d = new Date(nextMeeting.date + 'T00:00:00');
        const isCreator = nextMeeting.createdBy === user?.userId || (isManager && !nextMeeting.createdBy);
        return (
          <div style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
            borderRadius: 14, padding: '20px 28px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
              <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>{d.getDate()}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{MONTHS[d.getMonth()]}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}> Next Upcoming Meeting</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>{nextMeeting.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                {formatDate(nextMeeting.date)} · {nextMeeting.time} · {nextMeeting.attendees.length} attendee{nextMeeting.attendees.length !== 1 ? 's' : ''} · {nextMeeting.type === 'client' ? ' Client' : ' Internal'}
              </div>
            </div>
            {nextMeeting.link && (
              <a href={nextMeeting.link} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 18px', borderRadius: 8, background: '#10b981', color: '#fff', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none', marginRight: 10 }}>
                🔗 Join Meeting
              </a>
            )}
            {isCreator && (
              <button onClick={() => handleCancel(nextMeeting.id)}
                style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                ✕ Cancel Meeting
              </button>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* ── Left: Meeting List ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{isManager ? ' All Meetings' : '📅 My Schedule'}</div>
            <button className="btn" onClick={() => { if (!showForm) resetForm(); setShowForm(s => !s); }}
              style={{ background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '0.82rem', padding: '8px 18px', borderRadius: 8 }}>
              {showForm ? '✕ Cancel' : '＋ Create Meeting'}
            </button>
          </div>

          {meetDisplayList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: '#8890b0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <p>No meetings scheduled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const upcoming = meetDisplayList.filter(m => new Date(m.date + 'T23:59:59') >= now);
                const past = meetDisplayList.filter(m => new Date(m.date + 'T23:59:59') < now);
                return (
                  <>
                    {upcoming.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Upcoming</div>
                        {upcoming.map(renderMeetingCard)}
                      </>
                    )}
                    {past.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8890b0', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24 }}>Meeting History</div>
                        {past.map(renderMeetingCard)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Right: Create Form or Upcoming sidebar ── */}
        <div>
          {showForm ? (
            <div className="card" style={{ background: '#161829', border: '1px solid rgba(255,255,255,0.08)', padding: 24, borderRadius: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', marginBottom: 20 }}> Schedule Meeting</div>
              {errors.general && <div className="login-error" style={{ display: 'flex', marginBottom: 14 }}>{errors.general}</div>}
              <form onSubmit={handleCreate} noValidate>
                <div className="form-group mb16">
                  <label style={lbl}>Meeting Title *</label>
                  <input className="tf-input h44" style={{ ...inp, borderColor: errors.title ? '#ef4444' : 'rgba(255,255,255,0.08)' }}
                    placeholder="e.g. Weekly Standup" value={form.title} onChange={e => set('title', e.target.value)} />
                  {errors.title && <span className="field-error">{errors.title}</span>}
                </div>
                <div className="form-group mb16">
                  <label style={lbl}>Description / Context</label>
                  <textarea className="tf-input" rows="2" style={{ ...inp, height: 'auto', padding: 10, resize: 'none' }} placeholder="Brief agenda..." value={form.desc || ''} onChange={e => set('desc', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div><label style={lbl}>Date *</label>
                    <div style={{ position: 'relative' }}>
                      <input type="text" maxLength="10" placeholder="dd/mm/yyyy" className="tf-input h44" style={{ ...inp, borderColor: errors.date ? '#ef4444' : 'rgba(255,255,255,0.08)', paddingRight: 36 }} value={form.date} onChange={e => {
                        let v = e.target.value.replace(/[^\d/]/g, '');
                        set('date', v);
                      }} />
                      <span style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none', color: '#8890b0', fontSize: '1rem' }}>📅</span>
                      <input type="date" 
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, opacity: 0, cursor: 'pointer', zIndex: 10 }} 
                        onClick={(e) => {
                          try {
                            if (typeof e.target.showPicker === 'function') {
                              e.target.showPicker();
                            }
                          } catch (err) {}
                        }}
                        onChange={e => {
                          if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-');
                            set('date', `${d}/${m}/${y}`);
                          }
                        }} 
                      />
                    </div>
                    {errors.date && <span className="field-error">{errors.date}</span>}
                  </div>
                  <div><label style={lbl}>Time *</label>
                    <input type="time" className="tf-input h44" style={{ ...inp, borderColor: errors.time ? '#ef4444' : 'rgba(255,255,255,0.08)' }} value={form.time} onChange={e => set('time', e.target.value)} />
                    {errors.time && <span className="field-error">{errors.time}</span>}
                  </div>
                </div>
                <div className="form-group mb16">
                  <label style={lbl}>Meeting Link</label>
                  <input type="url" className="tf-input h44" style={inp} placeholder="https://meet.google.com/..." value={form.link || ''} onChange={e => set('link', e.target.value)} />
                </div>
                <div className="form-group mb16">
                  <label style={lbl}>Type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['internal','client'].map(t => (
                      <button key={t} type="button" onClick={() => set('type', t)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.type === t ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`, background: form.type === t ? '#7c3aed' : '#1e2035', color: form.type === t ? '#fff' : '#8890b0', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                        {t === 'internal' ? ' Internal' : ' Client'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.type === 'client' && (
                  <div className="form-group mb16">
                    <label style={lbl}>Client</label>
                    <select className="tf-input h44" style={inp} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                      <option value="">Select client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group mb16">
                  <label style={lbl}>{isManager ? 'Invite Employees *' : 'Invite Others'}</label>
                  {errors.attendees && <span className="field-error" style={{ display: 'block', marginBottom: 6 }}>{errors.attendees}</span>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {employees.filter(e => e.id !== user?.userId).map(emp => (
                      <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: form.attendees.includes(emp.id) ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${form.attendees.includes(emp.id) ? '#7c3aed66' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.attendees.includes(emp.id)} onChange={() => toggleAttendee(emp.id)} style={{ accentColor: '#7c3aed' }} />
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: emp.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: '#fff' }}>{emp.avatar}</div>
                        <div><div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{emp.name}</div><div style={{ fontSize: '0.65rem', color: '#8890b0' }}>{emp.dept}</div></div>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn" disabled={loading}
                  style={{ width: '100%', height: 44, background: '#7c3aed', color: '#fff', fontWeight: 800, borderRadius: 8, justifyContent: 'center' }}>
                  {loading ? 'Scheduling…' : ' Schedule'}
                </button>
              </form>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 14 }}>📋 Quick View</div>
              {meetDisplayList.filter(m => new Date(m.date + 'T00:00:00') >= now).slice(0, 4).map(m => {
                const d = new Date(m.date + 'T00:00:00');
                return (
                  <div key={m.id} onClick={() => setSelectedMeeting(m)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: m.type === 'client' ? 'var(--blue)' : 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                      <div style={{ fontSize: '0.9rem', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: '0.55rem', opacity: 0.8 }}>{MONTHS[d.getMonth()]}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#fff' }}>{m.title}</div>
                      <div style={{ fontSize: '0.68rem', color: '#8890b0' }}>{formatDate(m.date)} · ⏰ {m.time}</div>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => { resetForm(); setShowForm(true); }} style={{ width: '100%', marginTop: 14, padding: '10px', borderRadius: 8, border: '1px dashed rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.08)', color: '#a78bfa', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                ＋ Schedule a Meeting
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const lbl = { color: '#8890b0', fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 6 };
const inp = { background: '#1e2035', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' };

export default MeetingList;
