import React from 'react';

const LoadingSpinner = ({ fullScreen = false, message = 'Loading…' }) => {
  const style = fullScreen ? {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg, #0b0d1a)', zIndex: 9999,
    gap: '16px',
  } : {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '60px 20px', gap: '16px',
  };

  return (
    <div style={style}>
      <div style={{
        width: 44, height: 44,
        border: '3px solid rgba(124,58,237,0.2)',
        borderTop: '3px solid #7c3aed',
        borderRadius: '50%',
        animation: 'tf-spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: 0 }}>{message}</p>
      <style>{`@keyframes tf-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LoadingSpinner;
