import './DashboardCard.css';

export function DashboardCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className={`dashboard-card tone-${tone}`}>
      <span className="dashboard-card-label">{label}</span>
      <span className="dashboard-card-value">{value}</span>
      {hint && <span className="dashboard-card-hint">{hint}</span>}
    </div>
  );
}
