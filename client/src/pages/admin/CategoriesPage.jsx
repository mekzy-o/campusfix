/** Manage request categories. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { PRIORITY } from '../../lib/format';
import { categoryIcon } from '../../lib/icons';
import {
  Badge, ErrorBox, Field, Modal, PageHeader, PageLoader, PriorityBadge,
} from '../../components/ui';

const ICON_CHOICES = ['zap', 'droplets', 'armchair', 'wifi', 'projector', 'bed', 'fan', 'building'];

function CategoryForm({ category, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    icon: category?.icon || 'building',
    defaultPriority: category?.default_priority || 'MEDIUM',
    isActive: category ? category.is_active : true,
  });
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (body) => (category ? api.patch(`/categories/${category.id}`, body) : api.post('/categories', body)).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(res.message);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? `Edit ${category.name}` : 'Add a category'}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="category-form" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save category'}
          </button>
        </>
      )}
    >
      <form
        id="category-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.trim().length < 2) {
            setError('Enter a category name of at least 2 characters.');
            return;
          }
          const { isActive, ...rest } = form;
          mutation.mutate(category ? form : rest);
        }}
      >
        <ErrorBox>{error}</ErrorBox>
        <Field label="Name" htmlFor="cat-name">
          <input id="cat-name" className="input" value={form.name} onChange={set('name')} maxLength={80} />
        </Field>
        <Field label="What it covers" htmlFor="cat-desc" optional>
          <input id="cat-desc" className="input" value={form.description} onChange={set('description')} maxLength={255} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default priority" htmlFor="cat-priority">
            <select id="cat-priority" className="input" value={form.defaultPriority} onChange={set('defaultPriority')}>
              {Object.entries(PRIORITY).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <fieldset>
            <legend className="label">Icon</legend>
            <div className="flex flex-wrap gap-1">
              {ICON_CHOICES.map((name) => {
                const Icon = categoryIcon(name);
                return (
                  <label key={name} className={`cursor-pointer rounded-md border p-2 ${form.icon === name ? 'border-navy bg-navy-soft text-navy' : 'border-line text-muted'}`}>
                    <input type="radio" name="icon" value={name} checked={form.icon === name} onChange={set('icon')} className="sr-only" />
                    <Icon className="h-4 w-4" aria-label={name} />
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
        {category && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="accent-[#12395A]" checked={form.isActive} onChange={set('isActive')} />
            Available on the request form
          </label>
        )}
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => api.get('/categories', { params: { all: true } }).then((r) => r.data.data),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(res.message);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Categories"
        description="The kinds of problems people can report. Each has a default priority."
        actions={(
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden /> Add category
          </button>
        )}
      />
      <ul className="panel divide-y divide-line">
        {categories.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <li key={c.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy-soft text-navy">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {c.name} {!c.is_active && <Badge>Hidden</Badge>}
                </p>
                <p className="text-sm text-muted">{c.description || 'No description'}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <PriorityBadge priority={c.default_priority} />
                <span className="w-24 text-muted">{c.request_count} request{c.request_count === 1 ? '' : 's'}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => {
                    // eslint-disable-next-line no-alert
                    if (window.confirm(`Delete "${c.name}"? If requests use it, it will be hidden instead.`)) remove.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && <CategoryForm category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
