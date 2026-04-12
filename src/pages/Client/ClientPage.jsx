import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const ClientPage = ({ activePage }) => {
  const { user } = useAuth();
  const { data } = useData();
  const [internalSection, setInternalSection] = useState('overview');

  useEffect(() => {
    if (activePage === 'dashboard' || activePage === 'overview') setInternalSection('overview');
    else if (['reports', 'feedback', 'meetings'].includes(activePage)) setInternalSection(activePage);
  }, [activePage]);

  const clientInfo = data.clients.find(c => c.id === user.clientId);
  const clientReports = data.clientReports?.[user.clientId] || [];
  const deliverables = (data.tasks || []).filter(t => t.clientId === user.clientId && t.status === 'done').sort((a,b) => new Date(b.completedAt||0) - new Date(a.completedAt||0));
  const activeTasks = (data.tasks || []).filter(t => t.clientId === user.clientId && t.status !== 'done');
  // Only meetings that explicitly include this client
  const myMeetings = (data.meetings || []).filter(m => m.clientId === user.clientId || m.attendees?.includes(user.userId)).sort((a,b) => new Date(a.date+'T'+a.time) - new Date(b.date+'T'+b.time));
  const upcomingMeetings = myMeetings.filter(m => new Date(m.date+'T23:59:59') >= new Date());

  const downloadReport = (report) => {
    const lines = [
      `TEAMFLOW — CLIENT REPORT`,
      `${report.title}`,
      `Date: ${report.date}`,
      `Client: ${clientInfo?.name || ''}`,
      `Project: ${clientInfo?.project || ''}`,
      ``,
      report.summary,
      ``,
      `--- DELIVERABLES ---`,
      ...deliverables.map(d => `[DONE] ${d.title} — ${d.completedAt ? new Date(d.completedAt).toLocaleDateString() : 'N/A'}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${report.title.replace(/\s+/g,'_')}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const renderOverview = () => {
    if (!clientInfo) return <div className="empty-state">No project data found.</div>;
    const progColor = clientInfo.progress > 75 ? 'var(--green)' : clientInfo.progress > 40 ? 'var(--amber)' : 'var(--red)';
    return (
      <div className="section-wrap">
        {/* Banner */}
        <div className="card mb16" style={{ background: 'linear-gradient(135deg, var(--bg2), var(--bg3))', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div className="text-xs text-muted mb8 uppercase tracking-wider">Active Project</div>
              <h2 className="fw800 mb8" style={{ fontSize: '24px' }}>{clientInfo.project}</h2>
              <div className="text-sm text-muted">Managed by <strong className="text-default">{clientInfo.manager}</strong> · Budget: <strong className="text-default">{clientInfo.budget}</strong></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="fw900" style={{ fontSize: '48px', color: progColor, lineHeight: 1 }}>{clientInfo.progress}%</div>
              <div className="text-xs text-muted">complete</div>
              <div className={`badge mt8 badge-${clientInfo.status}`}>{clientInfo.status}</div>
            </div>
          </div>
          <div className="mt20" style={{ position: 'relative', zIndex: 1 }}>
            <div className="text-xs text-muted mb8">Overall Progress</div>
            <div className="progress-bar" style={{ height: '12px' }}>
              <div className="progress-fill" style={{ width: `${clientInfo.progress}%`, background: `linear-gradient(to right, var(--accent), ${progColor})` }} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          <div className="card" style={{ padding: 18, textAlign: 'center' }}><div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>{deliverables.length}</div><div style={{ fontSize: '0.75rem', color: '#8890b0' }}>Deliverables Done</div></div>
          <div className="card" style={{ padding: 18, textAlign: 'center' }}><div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' }}>{activeTasks.length}</div><div style={{ fontSize: '0.75rem', color: '#8890b0' }}>Active Tasks</div></div>
          <div className="card" style={{ padding: 18, textAlign: 'center' }}><div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#818cf8' }}>{upcomingMeetings.length}</div><div style={{ fontSize: '0.75rem', color: '#8890b0' }}>Upcoming Meetings</div></div>
        </div>

        {/* Project Phases */}
        <div className="card mb16">
          <div className="card-title"><span className="ct-icon" style={{ background: '#7c3aed22' }}></span> Project Phases</div>
          <div className="phases-list">
            {[
              { name: 'Discovery & Setup', pct: 100, done: true },
              { name: 'Design & Wireframes', pct: 100, done: true },
              { name: 'Development', pct: Math.min(clientInfo.progress * 1.3, 100), done: clientInfo.progress >= 77 },
              { name: 'Launch', pct: Math.max(clientInfo.progress - 70, 0), done: false },
            ].map((p, i) => (
              <div key={i} className="flex-center gap12 py8 border-b border-default">
                <div style={{ fontSize: '18px' }}></div>
                <div style={{ flex: 1 }}>
                  <div className="text-sm fw600 mb4">{p.name}</div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.pct}%`, background: p.done ? 'var(--green)' : 'var(--accent)' }} /></div>
                </div>
                <div className="text-xs fw700" style={{ width: '35px', textAlign: 'right', color: p.done ? 'var(--green)' : 'var(--text-muted)' }}>{Math.round(p.pct)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deliverables */}
        <div className="card">
          <div className="card-title">Recent Deliverables</div>
          {deliverables.length === 0 ? (
            <div className="text-muted text-sm pb8">No recently completed deliverables.</div>
          ) : (
            <div className="grid-3 gap12">
              {deliverables.slice(0, 6).map(d => (
                <div key={d.id} className="p12" style={{ background: 'var(--bg3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff', marginBottom: 6 }}>{d.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#8890b0', marginBottom: 10 }}>Completed: {d.completedAt ? new Date(d.completedAt).toLocaleDateString() : 'Recently'}</div>
                  {d.link ? (
                    <a href={d.link} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '6px 12px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700 }}>View Link</a>
                  ) : <span className="text-muted text-xs">No link provided</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content">
      {internalSection === 'overview' && renderOverview()}

      {/* ── MY REPORTS (redesigned) ── */}
      {internalSection === 'reports' && (
        <div className="section-wrap anim-fade-in">
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            My Reports
          </div>
          {clientReports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: '#8890b0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <p>No reports available yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
              {clientReports.map(r => (
                <div key={r.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid rgba(124,58,237,0.2)', background: 'linear-gradient(135deg,var(--bg2),var(--bg3))' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}></div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{r.title}</div>
                      <span style={{ fontSize: '0.7rem', background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>{r.date}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#c0c5d8', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 8 }}>{r.summary}</div>
                  <button onClick={() => downloadReport(r)} style={{ padding: '10px', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    ⬇ Download Report
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FEEDBACK ── */}
      {internalSection === 'feedback' && (
        <div className="card">
          <div className="card-title">Submit Feedback</div>
          <div className="form-group mb16">
            <label>Subject</label>
            <select className="tf-input">
              <option>Project Progress Update</option>
              <option>General Feedback</option>
              {activeTasks.map(t => <option key={t.id}>Task: {t.title}</option>)}
              {deliverables.map(t => <option key={t.id}>Review: {t.title}</option>)}
            </select>
          </div>
          <div className="form-group mb16">
            <label>Message *</label>
            <textarea className="tf-input" rows="5" placeholder="Share your thoughts..." />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Send Feedback</button>
        </div>
      )}

      {/* ── MEETINGS (read-only, client-focused) ── */}
      {internalSection === 'meetings' && (
        <div className="section-wrap anim-fade-in">
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            My Meetings
          </div>
          {upcomingMeetings.length === 0 && myMeetings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: '#8890b0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <p>No meetings scheduled yet. Your manager will invite you when a meeting is set.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {myMeetings.map(m => {
                const d = new Date(m.date + 'T00:00:00');
                const now = new Date();
                const isPast = new Date(m.date + 'T23:59:59') < now;
                const isToday = d.toDateString() === now.toDateString();
                return (
                  <div key={m.id} className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, opacity: isPast ? 0.5 : 1, border: isToday ? '1px solid #10b981' : '1px solid var(--border)', boxShadow: isToday ? '0 0 20px rgba(16,185,129,0.1)' : 'none' }}>
                    <div style={{ width: 60, height: 60, borderRadius: 14, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                      <div style={{ fontSize: '1.3rem', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{m.title}</div>
                        {isToday && <span style={{ background: '#10b98122', color: '#10b981', padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>TODAY</span>}
                        {isPast && <span style={{ background: 'rgba(255,255,255,0.06)', color: '#8890b0', padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem' }}>Past</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#8890b0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>{m.time}</span>
                        <span>{m.attendees?.length || 0} attendees</span>
                      </div>
                      {m.desc && <div style={{ fontSize: '0.82rem', color: '#c0c5d8', marginTop: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6 }}>{m.desc}</div>}
                    </div>
                    {m.link ? (
                      <a href={m.link} target="_blank" rel="noreferrer" style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', textDecoration: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 800, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Join Meeting
                      </a>
                    ) : (
                      <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.04)', color: '#8890b0', borderRadius: 10, fontSize: '0.8rem', flexShrink: 0, textAlign: 'center' }}>
                        Link coming soon
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientPage;
