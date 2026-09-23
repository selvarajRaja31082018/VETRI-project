import { useId, type TextareaHTMLAttributes } from 'react';
import './FormField.css';
import { IconAlert } from './icons';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /**
   * Show a "used / limit" counter. Pass the SAME limit the backend enforces -
   * this is a display aid, not a second validation rule, and it never blocks
   * input on its own.
   */
  showCount?: boolean;
}

export function Textarea({
  label,
  error,
  hint,
  required,
  showCount,
  id,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  const limit = typeof props.maxLength === 'number' ? props.maxLength : undefined;
  const used = typeof props.value === 'string' ? props.value.length : 0;
  const nearLimit = limit !== undefined && used > limit * 0.9;
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
      {(error || hint || showCount) && (
        <span className="field-footer">
          {error ? (
            <span className="field-error" role="alert">
              <IconAlert size={13} />
              {error}
            </span>
          ) : (
            hint && <span className="field-hint">{hint}</span>
          )}
          {showCount && limit !== undefined && (
            <span className={`field-count ${nearLimit ? 'is-near-limit' : ''}`.trim()}>
              {used} / {limit}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
