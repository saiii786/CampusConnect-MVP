/**
 * Typed calls to the backend's /auth and /me endpoints (docs/ARCHITECTURE.md §8.1).
 * Inputs are the parsed outputs of the shared zod schemas, so they are already normalised
 * (trimmed, lower-cased email) exactly as the server expects.
 */
import type {
  AuthSessionResponse,
  ForgotPasswordInput,
  LoginInput,
  MeResponse,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from '@cc/shared';
import { api } from '@/lib/api/client';

export const authApi = {
  signup: (input: SignupInput) => api.post<AuthSessionResponse>('/auth/signup', input, { auth: false }),
  login: (input: LoginInput) => api.post<AuthSessionResponse>('/auth/login', input, { auth: false }),
  verifyEmail: (input: VerifyEmailInput) => api.post<MeResponse>('/auth/verify-email', input),
  resendVerification: () => api.post<void>('/auth/resend-verification'),
  forgotPassword: (input: ForgotPasswordInput) => api.post<void>('/auth/forgot-password', input, { auth: false }),
  resetPassword: (input: ResetPasswordInput) => api.post<void>('/auth/reset-password', input, { auth: false }),
  me: () => api.get<MeResponse>('/me'),
};
