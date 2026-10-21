/** User management: add officers/admins, change roles, deactivate accounts. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Pencil, Search, UserPlus, Users } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { ROLE_LABEL, formatDate, timeAgo } from '../../lib/format';
import { userSchema } from '../../lib/schemas';
import { zodResolver } from '../../lib/zodResolver';
import { useAuth } from '../../context/AuthContext';
import {
  Avatar, Badge, EmptyState, ErrorBox, Field, Modal, PageHeader, Pagination, Spinner,
} from '../../components/ui';

function UserForm({ user, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);
  const [serverError, setServerError] = useState('');
  const [categoryIds, setCategoryIds] = useState(user?.categories?.map((c) => c.id) || []);
  const [isActive, setIsActive] = useState(user ? user.is_active : true);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const schema = isEdit ? userSchema : userSchema.refine((v) => v.password, { path: ['password'], message: 'Set a starting password' });
  const {
    register, handleSubmit, watch, setError, formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.full_name || '',
      email: user?.email || '',
      role: user?.role || 'OFFICER',
      password: '',
      phone: user?.phone || '',
      department: user?.department || (isEdit ? '' : 'Works & Maintenance Department'),
      idNumber: user?.id_number || '',
      specialisation: user?.specialisation || '',
    },
  });
  const role = watch('role');

  const mutation = useMutation({
    mutationFn: (body) => (isEdit ? api.patch(`/users/${user.id}`, body) : api.post('/users', body)).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['officers'] });
      toast.success(res.message);
      onClose();
    },
    onError: (err) => {
      Object.entries(fieldErrors(err)).forEach(([name, message]) => setError(name, { message }));
      setServerError(errorMessage(err));
    },
  });

  const onSubmit = ({ email, password, ...values }) => {
    const body = { ...values };
    if (!isEdit) body.email = email;
    if (password) body.password = password;
    if (role === 'OFFICER') body.categoryIds = categoryIds;
    else delete body.specialisation;
    if (isEdit) body.isActive = isActive;
    Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
    mutation.mutate(body);
  };

  const field = (name, props = {}) => ({
    id: `user-${name}`, className: 'input', 'aria-invalid': Boolean(errors[name]), ...props, ...register(name),
  });

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={isEdit ? `Edit ${user.full_name}` : 'Add a user'}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add user'}
          </button>
        </>
      )}
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ErrorBox>{serverError}</ErrorBox>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="user-fullName" error={errors.fullName?.message}>
            <input {...field('fullName')} />
          </Field>
          <Field label="Email address" htmlFor="user-email" error={errors.email?.message} hint={isEdit ? 'Email cannot be changed' : undefined}>
            <input type="email" {...field('email', { readOnly: isEdit })} />
          </Field>
          <Field label="Role" htmlFor="user-role">
            <select {...field('role')}>
              {Object.entries(ROLE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={isEdit ? 'Reset password' : 'Starting password'}
            htmlFor="user-password"
            error={errors.password?.message}
            hint={isEdit ? 'Leave blank to keep the current password' : 'Share it with the user; they can change it in their profile'}
          >
            <input type="text" autoComplete="new-password" {...field('password')} />
          </Field>
          <Field label="Phone" htmlFor="user-phone" optional>
            <input {...field('phone')} />
          </Field>
          <Field label="Staff or matric number" htmlFor="user-idNumber" optional>
            <input {...field('idNumber')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Department" htmlFor="user-department" optional>
              <input {...field('department')} />
            </Field>
          </div>
        </div>

        {role === 'OFFICER' && (
          <div className="space-y-4 rounded-md border border-line bg-[#f9faf8] p-4">
            <Field label="Trade or specialisation" htmlFor="user-specialisation" optional>
              <input placeholder="e.g. Electrician" {...field('specialisation')} />
            </Field>
            <fieldset>
              <legend className="label">Categories this officer can handle</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[#12395A]"
                      checked={categoryIds.includes(c.id)}
                      onChange={(e) => setCategoryIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((i) => i !== c.id)))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {isEdit && (
          <label className="flex items-start gap-3 rounded-md border border-line p-3">
            <input type="checkbox" className="mt-1 accent-[#12395A]" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>
              <span className="block font-semibold">Account is active</span>
              <span className="block text-sm text-muted">Deactivated users are signed out everywhere and cannot sign in. Their history is kept.</span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(null); // null | 'new' | user
  const role = searchParams.get('role') || '';
  const page = Number(searchParams.get('page')) || 1;
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = {
    role: role || undefined, q: debouncedQ || undefined, page, limit: 12,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get('/users', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const tabs = [['', 'Everyone'], ...Object.entries(ROLE_LABEL)];

  return (
    <>
      <PageHeader
        title="Users"
        description="Add maintenance officers and administrators, change roles and deactivate accounts."
        actions={(
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <UserPlus className="h-4 w-4" aria-hidden /> Add user
          </button>
        )}
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by role">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={role === key}
                onClick={() => setParam('role', key)}
                className={clsx('rounded-md px-3 py-1.5 text-sm font-semibold', role === key ? 'bg-navy text-white' : 'text-muted hover:bg-[#eceee9] hover:text-ink')}
              >
                {key === 'OFFICER' ? 'Officers' : key === '' ? label : `${label}s`}
              </button>
            ))}
          </div>
          <label className="relative md:w-72">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
            <input type="search" className="input pl-9" placeholder="Name, email, department or ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        {error && (
          <div className="p-4">
            <ErrorBox>{errorMessage(error)}</ErrorBox>
          </div>
        )}
        {isLoading ? (
          <div className="p-8 text-center">
            <Spinner label="Loading users" />
          </div>
        ) : data?.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-[#f9faf8] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Department</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Last sign-in</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((u) => (
                  <tr key={u.id} className={clsx(!u.is_active && 'text-muted')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {u.full_name}
                            {u.id === me.id && <span className="font-normal text-muted"> (you)</span>}
                          </p>
                          <p className="truncate text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p>{u.role_label}</p>
                      {u.categories?.length > 0 && <p className="max-w-[220px] truncate text-xs text-muted">{u.categories.map((c) => c.name).join(', ')}</p>}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">{u.department || '—'}</td>
                    <td className="px-4 py-3" title={u.last_login_at ? formatDate(u.last_login_at) : undefined}>
                      {u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3">{u.is_active ? <Badge tone="ok">Active</Badge> : <Badge>Deactivated</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.full_name}`}>
                        <Pencil className="h-4 w-4" aria-hidden /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No users found">
            Try another search or role.
          </EmptyState>
        )}
        <div className="border-t border-line">
          <Pagination pagination={data?.pagination} onPage={(p) => setParam('page', String(p))} />
        </div>
      </div>

      {editing && <UserForm user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
