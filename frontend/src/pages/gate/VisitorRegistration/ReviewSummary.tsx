import { Card } from '../../../components/Card';

/**
 * Compact confirmation shown beneath step 3, so the operator can check what is
 * about to be submitted without scrolling back through the wizard.
 */
export function ReviewSummary({
  photoUrl,
  items,
}: {
  photoUrl: string | null;
  items: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');

  return (
    <Card title="Review" subtitle="Check these details before registering." className="section-spacing" enterDelay={120}>
      <div className="review-layout">
        <div className="review-photo">
          {photoUrl ? (
            <img src={photoUrl} alt="Captured visitor" />
          ) : (
            <span className="review-photo-empty">No photo</span>
          )}
        </div>
        <dl className="review-list">
          {shown.map((item) => (
            <div key={item.label} className="review-item">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
