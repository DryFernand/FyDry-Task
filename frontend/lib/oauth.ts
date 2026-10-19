const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "810195441268-g4omp08tl1eekburuf3m5hpvbnkorduo.apps.googleusercontent.com";

const GITHUB_CLIENT_ID =
  process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "Ov23lifwQxx3ZuxlGNvB";

export function redirectToGoogleOAuth() {
  if (typeof window === "undefined") return;

  const redirectUri = `${window.location.origin}/auth/callback/google`;
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const options = {
    redirect_uri: redirectUri,
    client_id: GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);
  window.location.href = `${rootUrl}?${qs.toString()}`;
}

export function redirectToGitHubOAuth() {
  if (typeof window === "undefined") return;

  const redirectUri = `${window.location.origin}/auth/callback/github`;
  const rootUrl = "https://github.com/login/oauth/authorize";

  const options = {
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "user:email",
  };

  const qs = new URLSearchParams(options);
  window.location.href = `${rootUrl}?${qs.toString()}`;
}
