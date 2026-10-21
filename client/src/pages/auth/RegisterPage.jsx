import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../lib/api';
import { registerSchema } from '../../lib/schemas';
import { zodResolver } from '../../lib/zodResolver';
import { ErrorBox, Field } from '../../components/ui';
import AuthShell from './AuthShell';

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register, handleSubmit, watch, setError, formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '', email: '', role: 'STUDENT', idNumber: '', department: '', phone: '', password: '', confirmPassword: '',
    },
  });
  const role = watch('role');

  const onSubmit = async ({ confirmPassword, ...values }) => {
    setServerError('');
    try {
      const user = await signUp(values);
      toast.success(`Account created. Welcome, ${user.full_name.split(' ')[0]}!`);
      navigate('/', { replace: true });
    } catch (err) {
      const fields = fieldErrors(err);
      Object.entries(fields).forEach(([name, message]) => setError(name, { message }));
      setServerError(errorMessage(err));
    }
  };

  const input = (name, props = {}) => ({
    id: name,
    className: 'input',
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    ...props,
    ...register(name),
  });

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-1 text-muted">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-navy underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
        <ErrorBox>{serverError}</ErrorBox>

        <fieldset>
          <legend className="label">I am a</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['STUDENT', 'Student'],
              ['STAFF', 'Staff member'],
            ].map(([value, label]) => (
              <label
                key={value}
                className={clsx(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold',
                  role === value ? 'border-navy bg-navy-soft text-navy-dark' : 'border-line-strong bg-surface',
                )}
              >
                <input type="radio" value={value} className="accent-[#12395A]" {...register('role')} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <input autoComplete="name" {...input('fullName')} />
        </Field>
        <Field label="Email address" htmlFor="email" error={errors.email?.message}>
          <input type="email" autoComplete="email" {...input('email')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={role === 'STAFF' ? 'Staff number' : 'Matric number'} htmlFor="idNumber" error={errors.idNumber?.message} optional>
            <input {...input('idNumber')} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message} optional>
            <input type="tel" autoComplete="tel" {...input('phone')} />
          </Field>
        </div>
        <Field label={role === 'STAFF' ? 'Department or unit' : 'Department'} htmlFor="department" error={errors.department?.message} optional>
          <input {...input('department')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" error={errors.password?.message} hint="8+ characters with a letter and a number">
            <input type="password" autoComplete="new-password" {...input('password')} />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <input type="password" autoComplete="new-password" {...input('confirmPassword')} />
          </Field>
        </div>

        <button type="submit" className="btn btn-primary w-full py-2.5" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-faint">Maintenance officers and administrators are added by the Works &amp; Maintenance Department.</p>
      </form>
    </AuthShell>
  );
}
