import { apiRequest as baseRequest, getAuthApiBase } from "./api";

// Todas las llamadas de cuenta van a FyDry (cuenta única para la familia FyDry).
const apiRequest = (endpoint: string, options: RequestInit = {}) =>
  baseRequest(endpoint, options, getAuthApiBase());

export async function apiRegister(fullName: string, email: string, password: string) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
    }),
  });
}

export async function apiLogin(email: string, password: string) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export async function apiVerifyEmailOtp(email: string, code: string) {
  return apiRequest("/auth/verify-email-otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      code,
      code_type: "register_verification",
    }),
  });
}

export async function apiResendOtp(email: string, codeType: string = "register_verification") {
  return apiRequest("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      code_type: codeType,
    }),
  });
}

export async function apiForgotPassword(email: string) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function apiVerifyResetOtp(email: string, code: string) {
  return apiRequest("/auth/verify-reset-otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      code,
      code_type: "password_reset",
    }),
  });
}

export async function apiResetPassword(email: string, code: string, newPassword: string) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      email,
      code,
      new_password: newPassword,
    }),
  });
}

export async function apiGoogleAuth(idToken: string, redirectUri?: string) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
      redirect_uri: redirectUri,
    }),
  });
}

export async function apiGitHubAuth(codeOrToken: string) {
  return apiRequest("/auth/github", {
    method: "POST",
    body: JSON.stringify({ code_or_token: codeOrToken }),
  });
}
