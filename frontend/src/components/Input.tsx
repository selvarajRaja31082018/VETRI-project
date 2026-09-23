import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import './FormField.css';
import { IconAlert } from './icons';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Optional leading glyph. Use only where it genuinely aids scanning. */
  icon?: ReactNode;
}

export function Input({ label, error, hint, required, icon, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  const control = (
    <input
      id={fieldId}
      className={`field-control ${error ? 'has-error' : ''} ${className || ''}`.trim()}
      aria-invalid={!!error || undefined}
      aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
      required={required}
      {...props}
    />
  );

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
          {required && <span className="field-required">*</span>}
        </label>
      )}
      {icon ? (
        <span className="field-control-wrap">
          <span className="field-icon">{icon}</span>
          {control}
        </span>
      ) : (
        control
      )}
      {error && (
        <span id={`${fieldId}-error`} className="field-error" role="alert">
          <IconAlert size={13} />
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
