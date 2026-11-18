import React from 'react';

export default function FormField({ label, required, error, hint, style, children }) {
  return (
    <div className={`form-field${error ? ' has-error' : ''}`} style={style}>
      {label != null && (
        <label>
          {label}
          {required ? <span className="field-required"> *</span> : null}
        </label>
      )}
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="cell-sub">{hint}</div> : null}
    </div>
  );
}
