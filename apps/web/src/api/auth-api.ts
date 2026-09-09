import type { AuthErrorCode, AuthResponseDto } from "./schemawise-contracts";
import { HttpApiError, httpRequest, jsonRequest } from "./http-api";

export { HttpApiError as AuthApiError };
export interface AuthApi {
  register(email: string, password: string): Promise<AuthResponseDto>;
  login(email: string, password: string): Promise<AuthResponseDto>;
  me(): Promise<AuthResponseDto>;
  logout(csrfToken?: string): Promise<void>;
}

export const authApi: AuthApi = {
  register: (email, password) => httpRequest<AuthResponseDto, AuthErrorCode>("/auth/register", jsonRequest("POST", { email, password })),
  login: (email, password) => httpRequest<AuthResponseDto, AuthErrorCode>("/auth/login", jsonRequest("POST", { email, password })),
  me: () => httpRequest<AuthResponseDto, AuthErrorCode>("/auth/me", { credentials: "include" }),
  logout: (csrfToken) => httpRequest<void, AuthErrorCode>("/auth/logout", { method: "POST", credentials: "include", ...(csrfToken ? { headers: { "X-CSRF-Token": csrfToken } } : {}) }),
};
