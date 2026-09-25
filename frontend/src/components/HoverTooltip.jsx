import React from 'react';

// Generic hover-tooltip wrapper: wrap any element (a map pin, an icon, etc.)
// and pass `label` for the bubble content shown above it on hover. Only the
// hovered instance shows its own tooltip — each wrapper's `:hover` state is
// independent (see .hover-tooltip-wrap / .hover-tooltip in theme.css).
export default function HoverTooltip({ label, children, className = '', style }) {
  return (
    <span className={`hover-tooltip-wrap ${className}`.trim()} style={style}>
      {children}
      <span className="hover-tooltip">{label}</span>
    </span>
  );
}
