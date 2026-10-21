import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { loginSchema } from '../../lib/schemas';
import { zodResolver } from '../../lib/zodResolver';
import { ErrorBox, Field } from '../../components/ui';
import AuthShell from './AuthShell';

const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@campusfix.app' },
  { label: 'Maintenance officer', email: 'ibrahim.musa@campusfix.app' },
  { label: 'Student', email: 'student@campusfix.app' },
  { label: 'Staff', email: 'staff@campusfix.app' },
];
const DEMO_PASSWORD = 'CampusFix@2026';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register, handleSubmit, setValue, formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}`);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  const fillDemo = (email) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
  };

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="mt-1 text-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-navy underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
        <ErrorBox>{serverError}</ErrorBox>
        <Field label="Email address" htmlFor="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="input pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <button type="submit" className="btn btn-primary w-full py-2.5" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-10 rounded-lg border border-dashed border-line-strong p-4">
        <p className="text-sm font-semibold">Try a demo account</p>
        <p className="mt-0.5 text-sm text-muted">
          Choose a role to fill in the form. Password: <span className="font-semibold text-ink">{DEMO_PASSWORD}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} type="button" onClick={() => fillDemo(a.email)} className="btn btn-secondary btn-sm justify-start">
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
