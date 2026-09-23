import './ProgressSteps.css';
import { IconCheck } from './icons';

export interface ProgressStep {
  /** Two-digit marker matching the section card it refers to. */
  id: string;
  label: string;
}

/**
 * Visual section hierarchy for a long single-page form.
 *
 * IMPORTANT: this is presentation only. The form is not split into wizard
 * steps - every field stays on one page and submits together. The indicator
 * shows how far the operator has got by reflecting which sections already hold
 * data, so it must never gate navigation or block submission.
 */
export function ProgressSteps({
  steps,
  /** Index of the section the operator is working on. */
  currentIndex,
  /** Indexes that already hold enough data to count as done. */
  completed = [],
}: {
  steps: ProgressStep[];
  currentIndex: number;
  completed?: number[];
}) {
  return (
    <ol className="steps" aria-label="Form sections">
      {steps.map((step, index) => {
        const isComplete = completed.includes(index);
        const isCurrent = index === currentIndex && !isComplete;
        const state = isComplete ? 'is-complete' : isCurrent ? 'is-current' : 'is-upcoming';

        return (
          <li key={step.id} className={`steps-item ${state}`}>
            <span className="steps-marker" aria-hidden="true">
              {isComplete ? <IconCheck size={13} /> : step.id}
            </span>
            <span className="steps-label">{step.label}</span>
            {isComplete && <span className="sr-only">(complete)</span>}
            {isCurrent && <span className="sr-only">(current)</span>}
          </li>
        );
      })}
    </ol>
  );
}
