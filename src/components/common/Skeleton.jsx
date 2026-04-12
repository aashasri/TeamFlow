import React from 'react';

const Skeleton = ({ width, height, borderRadius = 8, margin = '0 0 10px 0' }) => {
  return (
    <div className="skeleton-box" style={{ width, height, borderRadius, margin }} />
  );
};

export const CardSkeleton = () => (
  <div className="card" style={{ padding: 20, marginBottom: 20 }}>
    <Skeleton width="40%" height="24px" margin="0 0 16px 0" />
    <Skeleton width="100%" height="12px" />
    <Skeleton width="100%" height="12px" />
    <Skeleton width="80%" height="12px" />
  </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
  <div className="card" style={{ padding: 20, overflow: 'hidden' }}>
    <Skeleton width="20%" height="20px" margin="0 0 20px 0" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <Skeleton width="30%" height="14px" margin="0" />
        <Skeleton width="20%" height="14px" margin="0" />
        <Skeleton width="20%" height="14px" margin="0" />
        <Skeleton width="30%" height="14px" margin="0" />
      </div>
    ))}
  </div>
);

export default Skeleton;
