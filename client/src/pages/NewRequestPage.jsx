/** Service request submission form (students and staff). */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { requestSchema, validateImages } from '../lib/schemas';
import { zodResolver } from '../lib/zodResolver';
import { categoryIcon } from '../lib/icons';
import ImagePicker from '../components/ImagePicker';
import {
  ErrorBox, Field, PageHeader, PageLoader,
} from '../components/ui';

const LOCATIONS = [
  'Hostel A (Male)', 'Hostel B (Female)', 'Hostel C (Female)', 'Hostel D (Male)', 'Main Library', 'Faculty of Science Block',
  'Faculty of Engineering', 'Senate Building', 'ICT Centre', 'Lecture Theatre 1', 'Lecture Theatre 2', 'Student Centre', 'Cafeteria',
  'Staff Quarters Block C',
];

const URGENCY = [
  ['LOW', 'Low', 'Inconvenient, can wait'],
  ['MEDIUM', 'Medium', 'Needs attention this week'],
  ['HIGH', 'High', 'Disrupting work or study'],
  ['URGENT', 'Urgent', 'Safety risk or major outage'],
];

export default function NewRequestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [serverError, setServerError] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const {
    register, handleSubmit, watch, setValue, setError, formState: { errors },
  } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      categoryId: '', title: '', description: '', location: '', room: '', priority: undefined,
    },
  });
  const categoryId = Number(watch('categoryId'));
  const priority = watch('priority');
  const description = watch('description') || '';
  const selectedCategory = categories?.find((c) => c.id === categoryId);

  const mutation = useMutation({
    mutationFn: (form) => api.post('/requests', form).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(res.message);
      navigate(`/requests/${res.data.id}`);
    },
    onError: (err) => {
      Object.entries(fieldErrors(err)).forEach(([name, message]) => setError(name, { message }));
      setServerError(errorMessage(err));
    },
  });

  const onFiles = (next) => {
    const problem = validateImages(next);
    setFileError(problem || '');
    if (!problem) setFiles(next);
  };

  const onSubmit = (values) => {
    setServerError('');
    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    });
    files.forEach((f) => form.append('images', f));
    mutation.mutate(form);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Report a problem" description="Tell the Works & Maintenance team what is wrong and where. You can follow the request until it is fixed.">
        <Link to="/requests" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> My requests
        </Link>
      </PageHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <ErrorBox>{serverError}</ErrorBox>

        <section className="panel p-5">
          <fieldset>
            <legend className="text-lg font-bold">What kind of problem is it?</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.map((c) => {
                const Icon = categoryIcon(c.icon);
                const selected = c.id === categoryId;
                return (
                  <label
                    key={c.id}
                    className={clsx(
                      'flex cursor-pointer flex-col gap-2 rounded-md border px-3 py-3 text-sm font-semibold transition-colors',
                      selected ? 'border-navy bg-navy-soft text-navy-dark ring-1 ring-navy' : 'border-line-strong hover:border-navy',
                    )}
                  >
                    <input
                      type="radio"
                      value={c.id}
                      className="sr-only"
                      {...register('categoryId', {
                        onChange: () => setValue('priority', undefined),
                      })}
                    />
                    <Icon className={clsx('h-5 w-5', selected ? 'text-navy' : 'text-muted')} aria-hidden />
                    {c.name}
                  </label>
                );
              })}
            </div>
            {errors.categoryId && <p className="mt-2 text-sm text-danger">{errors.categoryId.message}</p>}
            {selectedCategory?.description && <p className="mt-2 text-sm text-muted">Covers: {selectedCategory.description.toLowerCase()}.</p>}
          </fieldset>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-bold">Describe it</h2>
          <Field label="Short title" htmlFor="title" error={errors.title?.message} hint="For example: Leaking pipe under the bathroom sink">
            <input id="title" className="input" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} {...register('title')} />
          </Field>
          <Field label="What is happening?" htmlFor="description" error={errors.description?.message} hint={`When did it start, how bad is it, is anyone at risk? (${description.length}/2000)`}>
            <textarea
              id="description"
              rows={5}
              className="input resize-y"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'description-error' : undefined}
              {...register('description')}
            />
          </Field>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-bold">Where is it?</h2>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Building or hostel" htmlFor="location" error={errors.location?.message}>
              <input id="location" list="locations" className="input" aria-invalid={Boolean(errors.location)} aria-describedby={errors.location ? 'location-error' : undefined} {...register('location')} />
              <datalist id="locations">
                {LOCATIONS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <Field label="Room or area" htmlFor="room" error={errors.room?.message} optional>
              <input id="room" className="input" placeholder="e.g. Room 214" {...register('room')} />
            </Field>
          </div>
        </section>

        <section className="panel p-5">
          <fieldset>
            <legend className="text-lg font-bold">How urgent is it?</legend>
            <p className="mt-0.5 text-sm text-muted">
              {selectedCategory
                ? `If you don't choose, ${selectedCategory.name} requests default to ${selectedCategory.default_priority.toLowerCase()} priority.`
                : 'The administrator may adjust this after review.'}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {URGENCY.map(([value, label, hint]) => (
                <label
                  key={value}
                  className={clsx(
                    'cursor-pointer rounded-md border px-3 py-2.5 text-sm',
                    priority === value
                      ? value === 'URGENT' ? 'border-danger bg-danger-soft ring-1 ring-danger' : 'border-navy bg-navy-soft ring-1 ring-navy'
                      : 'border-line-strong hover:border-navy',
                  )}
                >
                  <input type="radio" value={value} className="sr-only" {...register('priority')} />
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-muted">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-bold">
            Photos <span className="text-base font-normal text-faint">(optional)</span>
          </h2>
          <p className="mb-3 text-sm text-muted">A clear photo helps the officer bring the right tools and parts.</p>
          <ImagePicker files={files} onChange={onFiles} error={fileError} />
        </section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/requests" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary px-6" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
}
