import { useId, type TextareaHTMLAttributes } from 'react';
import './FormField.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Textarea({ label, error, hint, required, id, className, ...props }: TextareaProps) {
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
      <textarea
        id={fieldId}
        className={`field-control ${error ? 'has-error' : ''} ${className || ''}`.trim()}
        aria-invalid={!!error || undefined}
        required={required}
        {...props}
      />
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      {!error && hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
