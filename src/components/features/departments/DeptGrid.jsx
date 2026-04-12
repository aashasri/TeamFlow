import React from 'react';
import { useData } from '../../../context/DataContext';

const DeptGrid = () => {
  const { data } = useData();
  const deptIcons = { 'Social Media': '📱', 'SEO': '🔍', 'Web Dev': '💻', 'Ads': '📢', 'Blogs': '✍️', 'Reports': '📊', 'Management': '👔' };

  return (
    <div className="dept-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
      {data.departments.map(d => (
        <div key={d.id} className="dept-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center', transition: 'var(--trans)' }}>
          <div className="dc-icon" style={{ fontSize: '28px', marginBottom: '10px' }}>{deptIcons[d.name] || '🏢'}</div>
          <div className="dc-name" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{d.name}</div>
          <div className="dc-head" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>{d.head}</div>
          <div className="dc-pct" style={{ 
            fontSize: '22px', fontWeight: 800, marginBottom: '6px',
            color: d.performance > 85 ? 'var(--green)' : d.performance > 70 ? 'var(--amber)' : 'var(--red)'
          }}>{d.performance}%</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ 
              width: `${d.performance}%`, 
              background: d.performance > 85 ? 'var(--green)' : d.performance > 70 ? 'var(--amber)' : 'var(--red)'
            }}></div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>{d.completed}/{d.tasks} tasks done</div>
        </div>
      ))}
    </div>
  );
};

export default DeptGrid;
