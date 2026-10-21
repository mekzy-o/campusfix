/** The signed-in user's profile and password. */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { ROLE_LABEL, formatDate } from '../lib/format';
import { passwordSchema } from '../lib/schemas';
import { zodResolver } from '../lib/zodResolver';
import { useAuth } from '../context/AuthContext';
import {
  Avatar, ErrorBox, Field, PageHeader,
} from '../components/ui';

function ProfileForm() {
  const { user, setUser } = useAuth();
  const {
    register, handleSubmit, formState: { isDirty, errors },
  } = useForm({
    defaultValues: {
      fullName: user.full_name, phone: user.phone || '', department: user.department || '', idNumber: user.id_number || '',
    },
  });
  const mutation = useMutation({
    mutationFn: (body) => api.patch('/auth/me', body).then((r) => r.data),
    onSuccess: (res) => {
      setUser(res.user);
      toast.success('Profile saved');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="panel space-y-4 p-5" noValidate>
      <h2 className="text-lg font-bold">Your details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="p-name" error={errors.fullName?.message}>
          <input id="p-name" className="input" {...register('fullName', { required: 'Enter your name', minLength: { value: 3, message: 'Enter your full name' } })} />
        </Field>
        <Field label="Email address" htmlFor="p-email" hint="Contact the administrator to change your email">
          <input id="p-email" className="input bg-[#f3f5f1]" value={user.email} readOnly />
        </Field>
        <Field label="Phone" htmlFor="p-phone" optional>
          <input id="p-phone" className="input" {...register('phone')} />
        </Field>
        <Field label={user.role === 'STUDENT' ? 'Matric number' : 'Staff number'} htmlFor="p-id" optional>
          <input id="p-id" className="input" {...register('idNumber')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Department" htmlFor="p-dept" optional>
            <input id="p-dept" className="input" {...register('department')} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [serverError, setServerError] = useState('');
  const {
    register, handleSubmit, reset, setError, formState: { errors },
  } = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const mutation = useMutation({
    mutationFn: ({ confirmPassword, ...body }) => api.post('/auth/change-password', body).then((r) => r.data),
    onSuccess: (res) => {
      reset();
      setServerError('');
      toast.success(res.message);
    },
    onError: (err) => {
      Object.entries(fieldErrors(err)).forEach(([name, message]) => setError(name, { message }));
      setServerError(errorMessage(err));
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="panel space-y-4 p-5" noValidate>
      <div>
        <h2 className="text-lg font-bold">Change password</h2>
        <p className="text-sm text-muted">You will stay signed in here. Other devices will be signed out.</p>
      </div>
      <ErrorBox>{serverError}</ErrorBox>
      <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
        <input id="currentPassword" type="password" autoComplete="current-password" className="input" aria-invalid={Boolean(errors.currentPassword)} {...register('currentPassword')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message} hint="8+ characters with a letter and a number">
          <input id="newPassword" type="password" autoComplete="new-password" className="input" aria-invalid={Boolean(errors.newPassword)} {...register('newPassword')} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <input id="confirmPassword" type="password" autoComplete="new-password" className="input" aria-invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Your profile" />
      <div className="panel mb-6 flex items-center gap-4 p-5">
        <Avatar name={user.full_name} />
        <div>
          <p className="text-lg font-bold">{user.full_name}</p>
          <p className="text-sm text-muted">
            {ROLE_LABEL[user.role]}
            {user.specialisation ? `, ${user.specialisation}` : ''}. Member since {formatDate(user.created_at)}
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}
