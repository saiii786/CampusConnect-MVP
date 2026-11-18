import { initialsOf } from '@/components/ui/avatar';
import { api } from '@/lib/api/client';
import { resolveMediaUrlWith } from '@/lib/api/media-url';
import { uploadImage } from './upload-image';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@/config/api-url', () => ({ getApiBaseUrl: () => 'http://192.168.1.5:3000/api/v1' }));
jest.mock('@/lib/api/client', () => ({ api: { post: jest.fn() } }));

const post = api.post as jest.Mock;

describe('resolveMediaUrlWith', () => {
  it('keeps absolute URLs and resolves API paths against the API origin', () => {
    const base = 'http://192.168.1.5:3000/api/v1';
    expect(resolveMediaUrlWith('https://x.supabase.co/storage/v1/object/public/media/a.jpg', base)).toBe(
      'https://x.supabase.co/storage/v1/object/public/media/a.jpg',
    );
    expect(resolveMediaUrlWith('/api/v1/uploads/files/users/a.jpg', base)).toBe(
      'http://192.168.1.5:3000/api/v1/uploads/files/users/a.jpg',
    );
  });
});

describe('initialsOf', () => {
  it('uses first and last initials', () => {
    expect(initialsOf('Priya Sharma')).toBe('PS');
    expect(initialsOf('ravi')).toBe('R');
    expect(initialsOf('  Sai  Ganesh Kumar ')).toBe('SK');
    expect(initialsOf('')).toBe('?');
  });
});

describe('uploadImage', () => {
  beforeEach(() => post.mockReset());

  it('signs with the real size, PUTs the bytes to the (resolved) upload URL and returns the key', async () => {
    const blob = new Blob(['x'.repeat(1234)], { type: 'image/jpeg' });
    post.mockResolvedValue({
      key: 'users/u/avatar/k.jpg',
      uploadUrl: '/api/v1/uploads/local/token',
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '',
    });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => blob })
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await expect(uploadImage('file:///photo.jpg', 'AVATAR', fetchImpl)).resolves.toBe('users/u/avatar/k.jpg');
    expect(post).toHaveBeenCalledWith('/uploads/sign', { purpose: 'AVATAR', contentType: 'image/jpeg', sizeBytes: 1234 });
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe('http://192.168.1.5:3000/api/v1/uploads/local/token');
    expect(init).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  });

  it('reports a failed upload as UPLOAD_FAILED and refuses files over 5 MB before signing', async () => {
    post.mockResolvedValue({ key: 'k', uploadUrl: 'https://s/x', method: 'PUT', headers: {}, expiresAt: '' });
    const small = new Blob(['x']);
    const failing = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => small })
      .mockResolvedValueOnce(new Response('', { status: 400 }));
    await expect(uploadImage('file:///a.jpg', 'PORTFOLIO', failing)).rejects.toMatchObject({ code: 'UPLOAD_FAILED' });

    post.mockClear();
    const huge = { size: 6 * 1024 * 1024 } as Blob;
    const tooBig = jest.fn().mockResolvedValueOnce({ blob: async () => huge });
    await expect(uploadImage('file:///b.jpg', 'PORTFOLIO', tooBig)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(post).not.toHaveBeenCalled();
  });
});
