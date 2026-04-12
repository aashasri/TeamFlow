import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const Topbar = ({ title, onAddClick }) => {
  const { user } = useAuth();
  const { data, markNotificationsRead }  = useData();
  const [time, setTime]           = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Close notif panel when clicking outside
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Collect notifications from context
  const notifications = (data._notifications || []).slice();
  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    if (markNotificationsRead) markNotificationsRead();
    setNotifOpen(false);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="topbar-right flex-center gap16">
        <div className="topbar-time">{dateStr} · <strong>{timeStr}</strong></div>

        <div className="flex-center border-l pl16 gap12">
          {/* New Task button — no rotation */}
          {user?.role === 'manager' && (
            <button
              id="btn-new-task"
              className="btn-new-task"
              onClick={onAddClick}
              title="Assign a new task"
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
              <span>New Task</span>
            </button>
          )}

          {/* Notification bell */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className="btn-icon"
              onClick={() => setNotifOpen(o => !o)}
              style={{ position: 'relative' }}
            >
              🔔
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 6, width: 8, height: 8,
                  background: '#ef4444', borderRadius: '50%', border: '2px solid var(--bg1)',
                }} />
              )}
            </button>

            {notifOpen && (
              <div className="notif-dropdown anim-scale-in" style={{
              position: 'absolute', top: '100%', right: 0, width: 340, 
              background: '#161829', border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: 12, marginTop: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 1000,
              overflow: 'hidden'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Recent Notifications</span>
                <span className="clickable" style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700 }} onClick={() => markNotificationsRead()}>Mark all as read</span>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }} className="custom-scrollbar">
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>No notifications yet</div>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} style={{ 
                      padding: '14px 20px', borderBottom: i === notifications.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                      background: n.read ? 'transparent' : 'rgba(124,58,237,0.05)',
                      transition: 'background 0.2s', position: 'relative'
                    }}>
                      {!n.read && <div style={{ position: 'absolute', left: 8, top: 22, width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />}
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ fontSize: '1.2rem' }}>{n.icon || '📣'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: '0.78rem', color: '#8890b0', lineHeight: 1.4 }}>{n.body}</div>
                          <div style={{ fontSize: '0.65rem', color: '#555', marginTop: 6, fontWeight: 600 }}>{n.time}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 5 && (
                <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#8890b0', fontWeight: 600 }}>Showing last {notifications.length} updates</span>
                </div>
              )}
            </div>
            )}
          </div>

          <button className="btn-icon">⚙️</button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
