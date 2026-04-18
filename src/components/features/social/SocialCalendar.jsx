import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { pushNotif, notifTemplates } from '../../../lib/notifications';
import { formatDate } from '../../../lib/dateUtils';

const CONTENT_TYPES = ['Static post', 'Photo', 'Reel', 'Carousel'];
const STATUS_OPTS   = ['Draft', 'Scheduled', 'Published'];
const BOOST_OPTS    = ['NO', 'Yes'];
const PLATFORMS     = ['instagram', 'facebook', 'x', 'tiktok', 'gmb', 'pinterest', 'youtube', 'linkedin'];
const PLATFORM_META = {
  instagram: { label: 'Instagram', icon: '', color: '#e1306c' },
  facebook:  { label: 'Facebook',  icon: '', color: '#1877f2' },
  x:         { label: 'X',         icon: '', color: '#aaa' },
  tiktok:    { label: 'TikTok',    icon: '', color: '#69c9d0' },
  gmb:       { label: 'GMB',       icon: '', color: '#4285f4' },
  pinterest: { label: 'Pinterest', icon: '', color: '#e60023' },
  youtube:   { label: 'YouTube',   icon: '', color: '#ff0000' },
  linkedin:  { label: 'LinkedIn',  icon: '', color: '#0a66c2' },
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUS_COLORS  = { Published: '#10b981', Scheduled: '#f59e0b', Draft: '#8890b0' };
const CONTENT_COLORS = { 'Static post': '#7c3aed', Photo: '#0ea5e9', Reel: '#ec4899', Carousel: '#f59e0b' };

/* ─────────────────────────────────────────
   Universal Inline-Editable Cell
   type: 'text' | 'date' | 'time' | 'number' | 'select' | 'url' | 'textarea'
───────────────────────────────────────── */
const EditCell = ({ value, type = 'text', options = [], placeholder = '', color, canEdit, onSave, style = {} }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    onSave(val);
    setEditing(false);
  };
  const cancel = () => { setVal(value || ''); setEditing(false); };

  // Render display
  const displayStyle = {
    cursor: canEdit ? 'pointer' : 'default',
    borderRadius: 4,
    padding: '2px 4px',
    transition: 'background 0.15s',
    display: 'inline-block',
    minWidth: 32,
    minHeight: 20,
    color: color || 'inherit',
    ...style,
  };

  if (!editing) {
    const isEmpty = !value || value === '';
    return (
      <div title={canEdit ? 'Click to edit' : ''}
        onClick={() => { if (canEdit) { setVal(value || ''); setEditing(true); } }}
        style={{
          ...displayStyle,
          background: canEdit ? 'rgba(255,255,255,0)' : 'transparent',
          ':hover': canEdit ? { background: 'rgba(124,58,237,0.12)' } : {},
        }}
        className={canEdit ? 'editable-cell' : ''}
      >
        {isEmpty
          ? <span style={{ color: '#444', fontSize: '0.68rem', fontStyle: 'italic' }}>{canEdit ? '+ add' : '—'}</span>
          : type === 'url'
            ? <a href={value} target="_blank" rel="noopener noreferrer"
                style={{ color: PLATFORM_META[color]?.color || '#0ea5e9', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}>
                🔗 {value.replace(/https?:\/\//, '').slice(0, 18)}{value.length > 25 ? '…' : ''}
              </a>
           : type === 'date'
            ? <span>{formatDate(value)}</span>
            : <span>{value}</span>
        }
      </div>
    );
  }

  const inputSt = {
    background: '#1a1c2e',
    border: '1px solid #7c3aed',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: '0.78rem',
    outline: 'none',
    width: type === 'textarea' ? 160 : type === 'date' || type === 'time' ? 130 : 120,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
      {type === 'select' ? (
        <select ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
          style={{ ...inputSt, width: 120, cursor: 'pointer' }}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
          rows={2} placeholder={placeholder}
          style={{ ...inputSt, resize: 'vertical' }}
          onKeyDown={e => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter' && e.ctrlKey) commit(); }}
        />
      ) : (
        <input ref={inputRef} type={type} value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          style={inputSt}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        />
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={commit}
          style={{ fontSize: '0.65rem', padding: '3px 8px', background: '#10b981', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 700, flex: 2 }}>
          ✓
        </button>
        <button onClick={cancel}
          style={{ fontSize: '0.65rem', padding: '3px 6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#8890b0', borderRadius: 4, cursor: 'pointer', flex: 1 }}>
          ✕
        </button>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
const SocialCalendar = ({ clientId = null, readOnly = false }) => {
  const { data, addSocialPost, updateSocialPost, deleteSocialPost } = useData();
  const { user } = useAuth();
  const today = new Date();
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const [selYear]               = useState(today.getFullYear());
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm] = useState(defaultForm(user?.name));

  const canEdit = !readOnly;

  const posts = (data.socialPosts || []).filter(p => {
    if (clientId && p.clientId !== clientId) return false;
    const d = new Date((p.submissionDate || p.publishDate || '') + 'T00:00:00');
    return d.getMonth() === selMonth && d.getFullYear() === selYear;
  }).sort((a, b) => (a.submissionDate || '').localeCompare(b.submissionDate || ''));

  /* Generic field updater for any top-level field */
  const saveField = async (postId, field, val) => {
    await updateSocialPost(postId, { [field]: val });
  };

  /* Platform link updater */
  const saveLink = async (postId, platform, url) => {
    const post = data.socialPosts?.find(p => p.id === postId);
    if (!post) return;
    const updatedLinks = { ...(post.links || {}), [platform]: url };
    await updateSocialPost(postId, { links: updatedLinks });
    if (url) pushNotif(notifTemplates.socialLinkPosted(post.contentTheme || 'Post'));
  };

  const handleAdd = async () => {
    if (!form.contentTheme.trim()) return;
    const links = {};
    PLATFORMS.forEach(p => { links[p] = form['link_' + p] || ''; });
    await addSocialPost({
      ...form,
      submissionDate: form.publishDate || today.toISOString().split('T')[0],
      links,
      clientId: clientId || null,
    });
    setForm(defaultForm(user?.name));
    setShowAdd(false);
  };

  const published = posts.filter(p => p.status === 'Published').length;
  const scheduled = posts.filter(p => p.status === 'Scheduled').length;
  const drafts    = posts.filter(p => p.status === 'Draft').length;

  return (
    <div className="anim-fade-in">
      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 50%,#ec4899 100%)', borderRadius: '16px 16px 0 0', padding: '24px 28px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: 0 }}>Social Media Calendar — {MONTHS[selMonth]}</h2>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            {MONTHS.map((m, i) => <option key={m} value={i} style={{ color: '#000' }}>{m}</option>)}
          </select>
          {canEdit && (
            <button onClick={() => setShowAdd(true)}
              style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              ＋ Add Entry
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)' }}>
            <span>✅ {published} Published</span>
            <span>⏰ {scheduled} Scheduled</span>
            <span>📝 {drafts} Drafts</span>
          </div>
        </div>
      </div>

      {/* Edit hint bar */}
      {canEdit && (
        <div style={{ background: 'rgba(124,58,237,0.08)', borderLeft: '3px solid #7c3aed', padding: '8px 20px', fontSize: '0.72rem', color: '#a78bfa', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>✏️ <strong>Click any cell</strong> to edit it inline — press <kbd style={{ background: '#1e2035', padding: '1px 5px', borderRadius: 3 }}>Enter</kbd> to save, <kbd style={{ background: '#1e2035', padding: '1px 5px', borderRadius: 3 }}>Esc</kbd> to cancel</span>
          <span>• Platform links in the last 6 columns support external URLs</span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', background: 'var(--bg2)', borderRadius: '0 0 16px 16px', border: '1px solid var(--border)', borderTop: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: '#c4f566' }}>
              <th colSpan={9}  style={{ ...thHGrp, borderRight: '2px solid #f97316' }}>📋 Content Planning</th>
              <th colSpan={6}  style={{ ...thHGrp, borderRight: '2px solid #f97316' }}>📅 Publishing Details</th>
              <th colSpan={canEdit ? 9 : 8}  style={thHGrp}>
                🔗 Links of Published Posts
                {canEdit && <span style={{ fontSize: '0.62rem', fontWeight: 400, opacity: 0.7, marginLeft: 6 }}>(click cell to add/edit)</span>}
              </th>
            </tr>
            <tr style={{ background: '#c4f566', borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
              {[
                'Sub. Date','Ref Link','Asset Link','Content Type','Owner','Remarks','Plan B','Content Theme','Caption',
              ].map((h, i) => <th key={h} style={{ ...thStyle, ...(i === 8 ? { borderRight: '2px solid #f97316' } : {}) }}>{h}</th>)}
              {['Status','Boost','Budget (€)','Publish Date','Publish Time','Post Objective'].map((h, i) => (
                <th key={h} style={{ ...thStyle, ...(i === 5 ? { borderRight: '2px solid #f97316' } : {}) }}>{h}</th>
              ))}
              {PLATFORMS.map((p, i) => (
                <th key={p} style={{ ...thStyle, color: PLATFORM_META[p].color }}>
                  {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
                </th>
              ))}
              {canEdit && <th style={{ ...thStyle, color: '#ef4444', textAlign: 'center' }}>Delete</th>}
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr><td colSpan={23} style={{ textAlign: 'center', padding: '48px', color: '#8890b0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
                No posts for {MONTHS[selMonth]}.{canEdit ? ' Click "＋ Add Entry" to create one.' : ''}
              </td></tr>
            ) : posts.map((p, idx) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)' }}>

                {/* Submission Date */}
                <td style={tdStyle}>
                  <EditCell value={p.submissionDate} type="date" canEdit={canEdit}
                    onSave={v => saveField(p.id, 'submissionDate', v)} />
                </td>

                {/* Ref Link */}
                <td style={tdStyle}>
                  <EditCell value={p.referenceLink} type="url" placeholder="https://..." canEdit={canEdit}
                    onSave={v => saveField(p.id, 'referenceLink', v)} />
                </td>

                {/* Asset Link */}
                <td style={tdStyle}>
                  <EditCell value={p.assetLink} type="url" placeholder="https://canva.com/..." canEdit={canEdit}
                    onSave={v => saveField(p.id, 'assetLink', v)} />
                </td>

                {/* Content Type */}
                <td style={tdStyle}>
                  <EditCell value={p.contentType} type="select" options={CONTENT_TYPES} canEdit={canEdit}
                    color={CONTENT_COLORS[p.contentType] || '#7c3aed'}
                    onSave={v => saveField(p.id, 'contentType', v)} />
                </td>

                {/* Owner */}
                <td style={tdStyle}>
                  <EditCell value={p.owner} type="text" placeholder="Owner name" canEdit={canEdit}
                    color="#10b981"
                    onSave={v => saveField(p.id, 'owner', v)} />
                </td>

                {/* Remarks */}
                <td style={tdStyle}>
                  <EditCell value={p.remarks} type="text" placeholder="Remarks…" canEdit={canEdit}
                    onSave={v => saveField(p.id, 'remarks', v)} />
                </td>

                {/* Plan B */}
                <td style={tdStyle}>
                  <EditCell value={p.planB} type="text" placeholder="Backup plan…" canEdit={canEdit}
                    color={p.planB ? '#f59e0b' : undefined}
                    onSave={v => saveField(p.id, 'planB', v)} />
                </td>

                {/* Content Theme */}
                <td style={{ ...tdStyle, minWidth: 110 }}>
                  <EditCell value={p.contentTheme} type="text" placeholder="Theme…" canEdit={canEdit}
                    style={{ fontWeight: 700, color: '#fff' }}
                    onSave={v => saveField(p.id, 'contentTheme', v)} />
                </td>

                {/* Caption */}
                <td style={{ ...tdStyle, borderRight: '2px solid rgba(249,115,22,0.3)', minWidth: 130 }}>
                  <EditCell value={p.caption} type="textarea" placeholder="Caption…" canEdit={canEdit}
                    onSave={v => saveField(p.id, 'caption', v)} />
                </td>

                {/* Status */}
                <td style={tdStyle}>
                  <EditCell value={p.status} type="select" options={STATUS_OPTS} canEdit={canEdit}
                    color={STATUS_COLORS[p.status]}
                    onSave={v => saveField(p.id, 'status', v)} />
                </td>

                {/* Boost */}
                <td style={tdStyle}>
                  <EditCell value={p.boost} type="select" options={BOOST_OPTS} canEdit={canEdit}
                    color={p.boost === 'Yes' ? '#10b981' : '#ec4899'}
                    onSave={v => saveField(p.id, 'boost', v)} />
                </td>

                {/* Budget */}
                <td style={tdStyle}>
                  <EditCell value={p.budget} type="number" placeholder="0" canEdit={canEdit}
                    color="#10b981"
                    onSave={v => saveField(p.id, 'budget', v)} />
                </td>

                {/* Publish Date */}
                <td style={tdStyle}>
                  <EditCell value={p.publishDate} type="date" canEdit={canEdit}
                    onSave={v => saveField(p.id, 'publishDate', v)} />
                </td>

                {/* Publish Time */}
                <td style={tdStyle}>
                  <EditCell value={p.publishTime} type="time" canEdit={canEdit}
                    onSave={v => saveField(p.id, 'publishTime', v)} />
                </td>

                {/* Post Objective */}
                <td style={{ ...tdStyle, borderRight: '2px solid rgba(249,115,22,0.3)', minWidth: 110 }}>
                  <EditCell value={p.postObjective} type="text" placeholder="e.g. Brand Awareness" canEdit={canEdit}
                    color="#0ea5e9"
                    onSave={v => saveField(p.id, 'postObjective', v)} />
                </td>

                {/* Platform Link Cells */}
                {PLATFORMS.map(plat => (
                  <td key={plat} style={{ ...tdStyle, minWidth: 150 }}>
                    <EditCell
                      value={p.links?.[plat] || ''}
                      type="url"
                      placeholder={`${PLATFORM_META[plat].label} URL…`}
                      canEdit={canEdit}
                      color={plat}
                      onSave={v => saveLink(p.id, plat, v)}
                    />
                  </td>
                ))}
                {canEdit && (
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'middle' }}>
                    <button onClick={() => { if(window.confirm('Delete this post?')) deleteSocialPost(p.id); }} 
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }} title="Delete Post">🗑</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add Entry Modal ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowAdd(false)}>
          <div style={{ background: '#161829', borderRadius: 16, padding: 28, width: 540, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: '1.15rem', marginBottom: 20 }}>📱 New Social Media Entry</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FField label="Content Type *">
                <select className="tf-input h44" style={iSt} value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value }))}>
                  {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </FField>
              <FField label="Status">
                <select className="tf-input h44" style={iSt} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </FField>
            </div>

            <FField label="Content Theme *">
              <input className="tf-input h44" style={iSt} placeholder="e.g. Spring Promo" value={form.contentTheme} onChange={e => setForm(f => ({ ...f, contentTheme: e.target.value }))} />
            </FField>

            <FField label="Caption">
              <textarea className="tf-input" rows={2} style={{ ...iSt, resize: 'none', padding: 10 }} placeholder="Write caption…" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
            </FField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FField label="Owner">
                <input className="tf-input h44" style={iSt} value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
              </FField>
              <FField label="Post Objective">
                <input className="tf-input h44" style={iSt} placeholder="e.g. Brand Awareness" value={form.postObjective} onChange={e => setForm(f => ({ ...f, postObjective: e.target.value }))} />
              </FField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FField label="Publish Date">
                <input type="date" className="tf-input h44" style={iSt} value={form.publishDate} onChange={e => setForm(f => ({ ...f, publishDate: e.target.value }))} />
              </FField>
              <FField label="Publish Time">
                <input type="time" className="tf-input h44" style={iSt} value={form.publishTime} onChange={e => setForm(f => ({ ...f, publishTime: e.target.value }))} />
              </FField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FField label="Boost">
                <select className="tf-input h44" style={iSt} value={form.boost} onChange={e => setForm(f => ({ ...f, boost: e.target.value }))}>
                  {BOOST_OPTS.map(b => <option key={b}>{b}</option>)}
                </select>
              </FField>
              <FField label="Budget (€)">
                <input type="number" className="tf-input h44" style={iSt} placeholder="0" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
              </FField>
              <FField label="Submission Date">
                <input type="date" className="tf-input h44" style={iSt} value={form.submissionDate} onChange={e => setForm(f => ({ ...f, submissionDate: e.target.value }))} />
              </FField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FField label="Remarks">
                <input className="tf-input h44" style={iSt} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </FField>
              <FField label="Plan B">
                <input className="tf-input h44" style={iSt} value={form.planB} onChange={e => setForm(f => ({ ...f, planB: e.target.value }))} />
              </FField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FField label="Reference Link">
                <input className="tf-input h44" style={iSt} placeholder="https://..." value={form.referenceLink} onChange={e => setForm(f => ({ ...f, referenceLink: e.target.value }))} />
              </FField>
              <FField label="Asset Link (Canva / Drive)">
                <input className="tf-input h44" style={iSt} placeholder="https://canva.com/..." value={form.assetLink} onChange={e => setForm(f => ({ ...f, assetLink: e.target.value }))} />
              </FField>
            </div>

            {/* Platform Links */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', color: '#8890b0', fontWeight: 700, marginBottom: 8 }}>📎 Platform Links (optional)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PLATFORMS.map(plat => (
                  <div key={plat} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 8, border: `1px solid ${PLATFORM_META[plat].color}33` }}>
                    <span style={{ fontSize: '0.78rem', color: PLATFORM_META[plat].color, fontWeight: 700, minWidth: 90 }}>
                      {PLATFORM_META[plat].icon} {PLATFORM_META[plat].label}
                    </span>
                    <input className="tf-input" style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '2px 4px', fontSize: '0.78rem', outline: 'none' }}
                      placeholder="https://..."
                      value={form['link_' + plat] || ''}
                      onChange={e => setForm(f => ({ ...f, ['link_' + plat]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8890b0', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: '11px', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
                ＋ Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline cell hover style */}
      <style>{`
        .editable-cell:hover {
          background: rgba(124,58,237,0.15) !important;
          border-radius: 4px;
          outline: 1px dashed rgba(124,58,237,0.5);
          cursor: text;
        }
        kbd { font-family: monospace; }
      `}</style>
    </div>
  );
};

/* ── helpers ── */
const defaultForm = (ownerName) => ({
  contentType: 'Static post', contentTheme: '', caption: '', owner: ownerName || 'Employee',
  status: 'Draft', boost: 'NO', budget: '', publishDate: '', publishTime: '',
  remarks: '', planB: '', postObjective: '', referenceLink: '', assetLink: '', submissionDate: '',
});

const thHGrp = { padding: '8px 14px', fontWeight: 800, fontSize: '0.8rem', color: '#1a1a2e', textAlign: 'left' };
const thStyle = { padding: '8px 10px', fontWeight: 700, fontSize: '0.72rem', color: '#1a1a2e', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid rgba(0,0,0,0.1)' };
const tdStyle = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', verticalAlign: 'top' };
const iSt    = { background: '#1e2035', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' };

const FField = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: '0.78rem', color: '#8890b0', display: 'block', marginBottom: 4, fontWeight: 600 }}>{label}</label>
    {children}
  </div>
);

export default SocialCalendar;
