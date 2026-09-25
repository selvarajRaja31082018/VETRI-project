import { IconCheck } from '../../../components/icons';
import './RegistrationStepper.css';

export interface WizardStep {
  id: string;
  label: string;
}

/**
 * Progress rail for the registration wizard.
 *
 * A completed step is clickable so the operator can jump back and correct
 * something; a step ahead of the current one is not, because the fields it
 * depends on have not been filled yet.
 */
export function RegistrationStepper({
  steps,
  current,
  furthest,
  onSelect,
}: {
  steps: WizardStep[];
  current: number;
  /** Highest step reached so far - everything up to it is revisitable. */
  furthest: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="wizard-steps" aria-label="Registration progress">
      {steps.map((step, index) => {
        const isComplete = index < current;
        const isCurrent = index === current;
        const canVisit = index <= furthest;
        const state = isComplete ? 'is-complete' : isCurrent ? 'is-current' : 'is-upcoming';

        return (
          <li key={step.id} className={`wizard-step ${state}`}>
            <button
              type="button"
              className="wizard-step-button"
              onClick={() => canVisit && onSelect(index)}
              disabled={!canVisit}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="wizard-step-marker" aria-hidden="true">
                {isComplete ? <IconCheck size={13} /> : step.id}
              </span>
              <span className="wizard-step-label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
