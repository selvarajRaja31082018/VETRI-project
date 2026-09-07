import { useId, type InputHTMLAttributes } from 'react';
import './FormField.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Input({ label, error, hint, required, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
          {required && <span className="field-required">*</span>}
        </label>
      )}
      <input
        id={fieldId}
        className={`field-control ${error ? 'has-error' : ''} ${className || ''}`.trim()}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        required={required}
        {...props}
      />
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={`${fieldId}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}
