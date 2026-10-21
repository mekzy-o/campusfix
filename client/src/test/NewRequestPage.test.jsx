import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './utils';
import NewRequestPage from '../pages/NewRequestPage';
import { api } from '../lib/api';
import { validateImages } from '../lib/schemas';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } };
});

const categories = [
  { id: 1, name: 'Electricity & Power', icon: 'zap', default_priority: 'HIGH', description: 'Faulty sockets' },
  { id: 2, name: 'Plumbing & Water', icon: 'droplets', default_priority: 'HIGH', description: 'Leaking pipes' },
];

beforeEach(() => {
  api.get.mockResolvedValue({ data: { data: categories } });
  api.post.mockReset();
});

describe('<NewRequestPage />', () => {
  it('shows every validation message when submitted empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestPage />, { route: '/new', path: '/new' });
    await user.click(await screen.findByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText('Choose a category')).toBeInTheDocument();
    expect(screen.getByText('Use at least 5 characters')).toBeInTheDocument();
    expect(screen.getByText('Describe the problem in at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Enter the building or hostel')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('explains the default priority for the chosen category', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestPage />, { route: '/new', path: '/new' });
    await user.click(await screen.findByText('Plumbing & Water'));
    expect(screen.getByText(/Plumbing & Water requests default to high priority/)).toBeInTheDocument();
  });

  it('sends a multipart form with the photo attached', async () => {
    api.post.mockResolvedValue({ data: { message: 'Request SR-2026-00001 submitted successfully', data: { id: 'abc' } } });
    const user = userEvent.setup();
    renderWithProviders(<NewRequestPage />, { route: '/new', path: '/new' });
    await user.click(await screen.findByText('Electricity & Power'));
    await user.type(screen.getByLabelText('Short title'), 'Sparking socket in room');
    await user.type(screen.getByLabelText('What is happening?'), 'Sparks whenever something is plugged in.');
    await user.type(screen.getByLabelText('Building or hostel'), 'Hostel A (Male)');
    const photo = new File(['img'], 'socket.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Add photos'), photo);
    expect(screen.getByAltText(/socket.png/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/requests');
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('title')).toBe('Sparking socket in room');
    expect(form.get('categoryId')).toBe('1');
    expect(form.getAll('images')).toHaveLength(1);
  });
});

describe('validateImages', () => {
  const file = (name, type, size = 1000) => {
    const f = new File(['x'], name, { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  it('accepts valid images', () => {
    expect(validateImages([file('a.jpg', 'image/jpeg')])).toBeNull();
  });
  it('rejects other file types', () => {
    expect(validateImages([file('a.pdf', 'application/pdf')])).toMatch(/not a JPG, PNG or WEBP/);
  });
  it('rejects files over 3 MB', () => {
    expect(validateImages([file('big.png', 'image/png', 4 * 1024 * 1024)])).toMatch(/larger than 3 MB/);
  });
  it('rejects more than four photos', () => {
    expect(validateImages(Array.from({ length: 5 }, (_, i) => file(`${i}.png`, 'image/png')))).toMatch(/at most 4/);
  });
});
