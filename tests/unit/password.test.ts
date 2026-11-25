import { it, expect, vi, beforeEach } from 'vitest';
import argon2 from 'argon2';
const model = vi.hoisted(() => ({ getUserById: vi.fn(), updatePassword: vi.fn() }));
vi.mock('../../src/models/user.model.mts', () => model);
import { changePassword } from '../../src/services/password.service.mts';
const id = '64b7f0c2a1b2c3d4e5f60718';
beforeEach(() => vi.clearAllMocks());
it('verifies the current password and persists an Argon2 hash for the authenticated user', async () => {
  const hash = await argon2.hash('old-password');
  model.getUserById.mockResolvedValue({ password: hash });
  model.updatePassword.mockResolvedValue({ matchedCount: 1 });
  await changePassword(id, 'old-password', 'new-password');
  const args = model.updatePassword.mock.calls[0]!;
  expect(args.slice(0, 2)).toEqual([id, hash]);
  expect(await argon2.verify(args[2], 'new-password')).toBe(true);
  expect(await argon2.verify(args[2], 'old-password')).toBe(false);
});
it('rejects invalid authentication and input', async () => {
  await expect(changePassword('', 'old', 'new-password')).rejects.toMatchObject({ statusCode: 401 });
  await expect(changePassword(id, 'old', 'short')).rejects.toMatchObject({ statusCode: 400 });
  expect(model.updatePassword).not.toHaveBeenCalled();
});
it('rejects incorrect current passwords', async () => {
  model.getUserById.mockResolvedValue({ password: await argon2.hash('correct') });
  await expect(changePassword(id, 'wrong', 'new-password')).rejects.toMatchObject({ statusCode: 401 });
  expect(model.updatePassword).not.toHaveBeenCalled();
});
