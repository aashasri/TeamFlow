import React from 'react';

const StatCard = ({ label, value, icon, delta, color = 'var(--accent)', onClick }) => {
  return (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-info">
        <div className="value">{value}</div>
        <div className="label">{label}</div>
        {delta && (
          <div className="delta" style={{ color: delta.includes('+') ? 'var(--green)' : 'var(--amber)' }}>
            {delta}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
