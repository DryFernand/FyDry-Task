export type AuthView =
  | "login"
  | "register"
  | "forgot-password"
  | "verify-otp"
  | "locked";

export interface AuthState {
  view: AuthView;
  email: string;
  failedAttempts: number;
  maxAttempts: number;
  lockoutTimer: number;
  otpCode: string[];
}
