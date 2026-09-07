import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage, getFieldErrors } from '../../utils/errors';
import { ROLE_HOME } from '../../utils/constants';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!identifier.trim() || !password) {
      setFieldErrors({
        identifier: !identifier.trim() ? 'Email or mobile is required' : '',
        password: !password ? 'Password is required' : '',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({ identifier: identifier.trim(), password });
      const state = location.state as LocationState | null;
      navigate(state?.from || ROLE_HOME[user.roleCode], { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <form className="login-card" onSubmit={handleSubmit} noValidate style={{ width: '100%', maxWidth: 380 }}>
        <h2 style={{ marginBottom: '0.25rem' }}>Sign in</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Use your VETRI account credentials to continue.
        </p>

        {formError && (
          <div
            role="alert"
            style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: '0.7rem 0.9rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {formError}
          </div>
        )}

        <Input
          label="Email or mobile number"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldErrors.identifier}
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          placeholder="••••••••"
        />

        <Button type="submit" isLoading={isSubmitting} style={{ width: '100%', marginTop: '0.5rem' }}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
