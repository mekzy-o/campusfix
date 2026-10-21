/** Edit a request's details (requester while pending; administrator until closed). */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { PRIORITY } from '../lib/format';
import { requestSchema } from '../lib/schemas';
import { zodResolver } from '../lib/zodResolver';
import { ErrorBox, Field, Modal } from './ui';

export default function EditRequestModal({ request, onClose }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState('');
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data.data),
  });

  const {
    register, handleSubmit, setError, formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      categoryId: String(request.category_id),
      title: request.title,
      description: request.description,
      location: request.location,
      room: request.room || '',
      priority: request.priority,
    },
  });

  const mutation = useMutation({
    mutationFn: (body) => api.patch(`/requests/${request.id}`, body).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['request', request.id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.success(res.message);
      onClose();
    },
    onError: (err) => {
      Object.entries(fieldErrors(err)).forEach(([name, message]) => setError(name, { message }));
      setServerError(errorMessage(err));
    },
  });

  const onSubmit = (values) => mutation.mutate({ ...values, room: values.room || undefined, priority: values.priority || undefined });

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`Edit ${request.reference}`}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-request" className="btn btn-primary" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      )}
    >
      <form id="edit-request" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <ErrorBox>{serverError}</ErrorBox>
        <Field label="Title" htmlFor="edit-title" error={errors.title?.message}>
          <input id="edit-title" className="input" aria-invalid={Boolean(errors.title)} {...register('title')} />
        </Field>
        <Field label="Description" htmlFor="edit-description" error={errors.description?.message}>
          <textarea id="edit-description" rows={4} className="input" aria-invalid={Boolean(errors.description)} {...register('description')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="edit-category" error={errors.categoryId?.message}>
            <select id="edit-category" className="input" {...register('categoryId')}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="edit-priority">
            <select id="edit-priority" className="input" {...register('priority')}>
              {Object.entries(PRIORITY).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Building or hostel" htmlFor="edit-location" error={errors.location?.message}>
            <input id="edit-location" className="input" aria-invalid={Boolean(errors.location)} {...register('location')} />
          </Field>
          <Field label="Room or area" htmlFor="edit-room" optional>
            <input id="edit-room" className="input" {...register('room')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
