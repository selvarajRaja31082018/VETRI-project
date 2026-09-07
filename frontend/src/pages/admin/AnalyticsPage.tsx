import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services/reportService';
import { requestService } from '../../services/requestService';
import { formatDate } from '../../utils/formatters';

const CHART_COLORS = ['#7a1024', '#b5750a', '#2b5b9c', '#1a7f4e', '#8a6d3b', '#6d6058'];

export function AnalyticsPage() {
  const trends = useAsync(() => reportService.trends(14), []);
  const categories = useAsync(() => reportService.requests({}), []);
  const performance = useAsync(() => reportService.representatives({}), []);
  const dashboard = useAsync(() => requestService.dashboard(), []);

  return (
    <div>
      <PageHeader title="Analytics" description="Visitor demand trends, request categories and representative performance." />

      <div className="two-col" style={{ marginBottom: '1.5rem' }}>
        <Card title="Daily visitor volume">
          {trends.isLoading && <LoadingSpinner />}
          {!trends.isLoading && trends.error && <ErrorState message={trends.error} onRetry={trends.reload} />}
          {!trends.isLoading && trends.data && trends.data.length === 0 && (
            <EmptyState title="No visitor activity yet" description="Data will appear once visitors are registered." />
          )}
          {!trends.isLoading && trends.data && trends.data.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trends.data.map((d) => ({ ...d, label: formatDate(d.day) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#7a1024" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Requests by category">
          {categories.isLoading && <LoadingSpinner />}
          {!categories.isLoading && categories.error && <ErrorState message={categories.error} onRetry={categories.reload} />}
          {!categories.isLoading && (categories.data?.length ?? 0) === 0 && (
            <EmptyState title="No categorised requests" description="Categories appear once grievances are recorded." />
          )}
          {!categories.isLoading && categories.data && categories.data.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categories.data as Array<{ category: string; total: number }>}
                  dataKey="total"
                  nameKey="category"
                  outerRadius={90}
                  label
                >
                  {(categories.data as Array<{ category: string }>).map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Representative performance">
        {performance.isLoading && <LoadingSpinner />}
        {!performance.isLoading && performance.error && (
          <ErrorState message={performance.error} onRetry={performance.reload} />
        )}
        {!performance.isLoading && (performance.data?.length ?? 0) === 0 && (
          <EmptyState title="No performance data yet" description="Assign and resolve visits to see representative statistics." />
        )}
        {!performance.isLoading && performance.data && performance.data.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={performance.data as Array<{ representative_name: string; assigned: number; resolved: number }>}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="representative_name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="assigned" fill="#2b5b9c" radius={[6, 6, 0, 0]} name="Assigned" />
              <Bar dataKey="resolved" fill="#1a7f4e" radius={[6, 6, 0, 0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {dashboard.data && (
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Overall resolution rate:{' '}
          <strong>
            {dashboard.data.allTime.total > 0
              ? `${Math.round((dashboard.data.allTime.resolved / dashboard.data.allTime.total) * 100)}%`
              : '0%'}
          </strong>
        </p>
      )}
    </div>
  );
}
