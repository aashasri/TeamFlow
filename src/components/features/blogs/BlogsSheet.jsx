import React, { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { formatDate } from '../../../lib/dateUtils';

const BlogsSheet = () => {
  const { data, addBlogsSheetRow, updateBlogsSheetRow } = useData();
  const { user } = useAuth();
  
  const isManager = user?.role === 'manager';
  
  const [newRow, setNewRow] = useState({ contentLink: '', reportLink: '', previewLink: '', comment: '' });
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const blogs = data.blogsSheet || [];

  const handleAdd = async () => {
    if (!newRow.contentLink.trim()) return alert('Content Link is required.');
    setSubmitting(true);
    const { error } = await addBlogsSheetRow({ ...newRow, createdBy: user?.userId });
    if (!error) setNewRow({ contentLink: '', reportLink: '', previewLink: '', comment: '' });
    else alert('Failed to add row: ' + error.message);
    setSubmitting(false);
  };

  const handleSaveEdit = async () => {
    setSubmitting(true);
    const { error } = await updateBlogsSheetRow(editingId, editRow);
    if (!error) {
      setEditingId(null);
      setEditRow({});
    } else {
      alert('Failed to update: ' + error.message);
    }
    setSubmitting(false);
  };

  const startEdit = (b) => {
    setEditingId(b.id);
    setEditRow({ contentLink: b.contentLink || '', reportLink: b.reportLink || '', previewLink: b.previewLink || '', comment: b.comment || '', remark: b.remark || '' });
  };

  return (
    <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Bloog Sheet</div>
      </div>

      <table className="tf-table" style={{ width: '100%', minWidth: 800 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', textAlign: 'left' }}>
            <th style={{ padding: 12 }}>Date</th>
            <th style={{ padding: 12 }}>Content Link</th>
            <th style={{ padding: 12 }}>Report Link</th>
            <th style={{ padding: 12 }}>Preview w/ Caption</th>
            <th style={{ padding: 12 }}>Comment / Notes</th>
            <th style={{ padding: 12 }}>Manager Remark</th>
            <th style={{ padding: 12, width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
            <tr style={{ background: 'rgba(124,58,237,0.05)' }}>
              <td style={{ padding: 12, color: '#8890b0', fontStyle: 'italic' }}>New...</td>
              <td style={{ padding: 12 }}>
                <input className="tf-input" placeholder="Paste doc link..." style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  value={newRow.contentLink} onChange={e => setNewRow({ ...newRow, contentLink: e.target.value })} />
              </td>
              <td style={{ padding: 12 }}>
                <input className="tf-input" placeholder="Paste report link..." style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  value={newRow.reportLink} onChange={e => setNewRow({ ...newRow, reportLink: e.target.value })} />
              </td>
              <td style={{ padding: 12 }}>
                <input className="tf-input" placeholder="Paste drive link..." style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  value={newRow.previewLink} onChange={e => setNewRow({ ...newRow, previewLink: e.target.value })} />
              </td>
              <td style={{ padding: 12 }}>
                <input className="tf-input" placeholder="Any comments..." style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  value={newRow.comment} onChange={e => setNewRow({ ...newRow, comment: e.target.value })} />
              </td>
              <td style={{ padding: 12, color: '#8890b0', fontSize: '0.8rem', fontStyle: 'italic' }}>N/A (Wait for Manager)</td>
              <td style={{ padding: 12 }}>
                <button onClick={handleAdd} disabled={submitting} className="btn" style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10b981', color: '#fff' }}>Add</button>
              </td>
            </tr>


          {blogs.map(b => {
             const isEditing = editingId === b.id;
             const dStr = b.createdAt ? formatDate(b.createdAt) : 'N/A';
             
             return (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: '0.8rem', color: '#8890b0' }}>{dStr}</td>
                
                <td style={{ padding: 12, fontSize: '0.8rem' }}>
                  {isEditing ? (
                    <input className="tf-input" value={editRow.contentLink} onChange={e => setEditRow({ ...editRow, contentLink: e.target.value })} style={{ padding: 6, fontSize: '0.8rem' }} />
                  ) : (
                    b.contentLink ? <a href={b.contentLink} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>{new URL(b.contentLink).hostname || 'View Link'}</a> : '—'
                  )}
                </td>
                
                <td style={{ padding: 12, fontSize: '0.8rem' }}>
                  {isEditing ? (
                    <input className="tf-input" value={editRow.reportLink} onChange={e => setEditRow({ ...editRow, reportLink: e.target.value })} style={{ padding: 6, fontSize: '0.8rem' }} />
                  ) : (
                    b.reportLink ? <a href={b.reportLink} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>{new URL(b.reportLink).hostname || 'View Link'}</a> : '—'
                  )}
                </td>

                <td style={{ padding: 12, fontSize: '0.8rem' }}>
                  {isEditing ? (
                    <input className="tf-input" value={editRow.previewLink} onChange={e => setEditRow({ ...editRow, previewLink: e.target.value })} style={{ padding: 6, fontSize: '0.8rem' }} />
                  ) : (
                    b.previewLink ? <a href={b.previewLink} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>{new URL(b.previewLink).hostname || 'View Link'}</a> : '—'
                  )}
                </td>

                <td style={{ padding: 12, fontSize: '0.8rem' }}>
                  {isEditing ? (
                    <input className="tf-input" value={editRow.comment} onChange={e => setEditRow({ ...editRow, comment: e.target.value })} style={{ padding: 6, fontSize: '0.8rem' }} />
                  ) : (
                    b.comment || '—'
                  )}
                </td>

                <td style={{ padding: 12, fontSize: '0.8rem', background: isManager ? 'rgba(245,158,11,0.05)' : 'transparent', borderLeft: isManager ? '2px solid #f59e0b' : 'none' }}>
                  {isEditing && isManager ? (
                     <input className="tf-input" value={editRow.remark} placeholder="Add a remark..." onChange={e => setEditRow({ ...editRow, remark: e.target.value })} style={{ padding: 6, fontSize: '0.8rem', borderColor: '#f59e0b' }} />
                  ) : (
                    b.remark ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>{b.remark}</span> : <span style={{ color: '#8890b0', fontStyle: 'italic' }}>Pending...</span>
                  )}
                </td>

                <td style={{ padding: 12 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={handleSaveEdit} disabled={submitting} style={{ background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(b)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8890b0', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                  )}
                </td>
              </tr>
            );
          })}
          
          {blogs.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#8890b0' }}>No entries found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BlogsSheet;
