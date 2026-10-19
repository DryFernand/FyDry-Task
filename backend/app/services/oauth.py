from typing import Optional, Dict, Any
import httpx
from app.core.config import settings


async def exchange_google_code_or_token(code_or_token: str, redirect_uri: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Handles both Google authorization codes and Google ID tokens.
    Exchanges code for user info or verifies ID token.
    """
    async with httpx.AsyncClient() as client:
        # If it looks like an authorization code and we have client credentials
        if (len(code_or_token) < 150 or code_or_token.startswith("4/")) and settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
            token_url = "https://oauth2.googleapis.com/token"
            
            # List of possible redirect URIs to try if first one gets a mismatch
            candidate_redirect_uris = []
            if redirect_uri:
                candidate_redirect_uris.append(redirect_uri)
            candidate_redirect_uris.extend([
                f"{settings.FRONTEND_URL}/auth/callback/google",
                "http://localhost:3001/auth/callback/google",
            ])
            # Deduplicate while preserving order
            candidate_redirect_uris = list(dict.fromkeys(candidate_redirect_uris))

            for uri in candidate_redirect_uris:
                data = {
                    "code": code_or_token,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": uri,
                    "grant_type": "authorization_code",
                }
                try:
                    res = await client.post(token_url, data=data, timeout=12.0)
                    if res.status_code == 200:
                        token_data = res.json()
                        id_token = token_data.get("id_token")
                        if id_token:
                            verified = await verify_google_id_token(id_token)
                            if verified:
                                return verified
                        access_token = token_data.get("access_token")
                        if access_token:
                            user_info_res = await client.get(
                                "https://www.googleapis.com/oauth2/v3/userinfo",
                                headers={"Authorization": f"Bearer {access_token}"},
                                timeout=10.0,
                            )
                            if user_info_res.status_code == 200:
                                u_data = user_info_res.json()
                                return {
                                    "provider_id": u_data.get("sub"),
                                    "email": u_data.get("email"),
                                    "full_name": u_data.get("name", "Usuario Google"),
                                    "avatar_url": u_data.get("picture"),
                                    "email_verified": str(u_data.get("email_verified")).lower() == "true",
                                }
                    else:
                        print(f"[GOOGLE TOKEN EXCHANGE] Status {res.status_code} for uri {uri}: {res.text}")
                except Exception as e:
                    print(f"[GOOGLE OAUTH ERROR] {uri}: {e}")

        # Fallback to direct ID token verification
        return await verify_google_id_token(code_or_token)


async def verify_google_id_token(id_token: str) -> Optional[Dict[str, Any]]:
    """Verifies Google ID Token against Google OAuth2 tokeninfo endpoint."""
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                # Rechaza tokens emitidos para otras apps de Google
                if not settings.GOOGLE_CLIENT_ID or data.get("aud") != settings.GOOGLE_CLIENT_ID:
                    print("[GOOGLE TOKENINFO FAIL]: aud no coincide con GOOGLE_CLIENT_ID")
                    return None
                return {
                    "provider_id": data.get("sub"),
                    "email": data.get("email"),
                    "full_name": data.get("name", "Usuario Google"),
                    "avatar_url": data.get("picture"),
                    "email_verified": str(data.get("email_verified")).lower() == "true",
                }
            print(f"[GOOGLE TOKENINFO FAIL]: {response.status_code} {response.text}")
            return None
        except Exception as exc:
            print(f"[GOOGLE TOKENINFO ERROR]: {exc}")
            return None


async def get_github_user_profile(token_or_code: str) -> Optional[Dict[str, Any]]:
    """
    Exchanges GitHub authorization code for access token and retrieves user profile.
    """
    async with httpx.AsyncClient() as client:
        # Solo se aceptan códigos de autorización de nuestra app; nunca tokens crudos de terceros
        access_token = None
        if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
            token_url = "https://github.com/login/oauth/access_token"
            headers = {"Accept": "application/json"}
            data = {
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": token_or_code,
            }
            try:
                res = await client.post(token_url, headers=headers, json=data, timeout=10.0)
                if res.status_code == 200:
                    token_data = res.json()
                    access_token = token_data.get("access_token")
            except Exception as e:
                print(f"[GITHUB OAUTH ERROR]: {e}")

        if not access_token:
            return None

        # Fetch user profile using access token
        try:
            user_res = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=10.0,
            )
            if user_res.status_code != 200:
                return None

            user_data = user_res.json()
            email = user_data.get("email")

            # If email is private in profile, fetch primary verified email from emails endpoint
            if not email:
                emails_res = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                    timeout=10.0,
                )
                if emails_res.status_code == 200:
                    emails_data = emails_res.json()
                    primary_email = next(
                        (e["email"] for e in emails_data if e.get("primary") and e.get("verified")),
                        None,
                    )
                    email = primary_email

            if not email:
                email = f"{user_data.get('login')}@users.noreply.github.com"

            return {
                "provider_id": str(user_data.get("id")),
                "email": email,
                "full_name": user_data.get("name") or user_data.get("login", "Usuario GitHub"),
                "avatar_url": user_data.get("avatar_url"),
                "email_verified": True,
            }
        except Exception as exc:
            print(f"[GITHUB PROFILE ERROR]: {exc}")
            return None
