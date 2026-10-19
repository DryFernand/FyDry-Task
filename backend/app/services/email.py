import logging
from html import escape
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import aiosmtplib
from app.core.config import settings

logger = logging.getLogger("fy_dry_mailer")


def _get_base_html_template(title: str, content: str) -> str:
    """Generates clean, minimalist Vercel/Geist styled HTML email template."""
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{title}</title>
      <style>
        body {{
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #fcfcfc;
          margin: 0;
          padding: 40px 16px;
          color: #09090b;
        }}
        .container {{
          max-width: 500px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }}
        .logo {{
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.5px;
          color: #09090b;
          margin-bottom: 24px;
          display: inline-block;
        }}
        .logo-box {{
          background: #09090b;
          color: #ffffff;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          margin-right: 6px;
        }}
        h1 {{
          font-size: 20px;
          font-weight: 700;
          color: #09090b;
          margin-top: 0;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }}
        p {{
          font-size: 14px;
          color: #52525b;
          line-height: 1.6;
          margin: 12px 0;
        }}
        .otp-box {{
          background: #f4f4f5;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #09090b;
          margin: 24px 0;
          font-family: monospace;
        }}
        .footer {{
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #f4f4f5;
          font-size: 11px;
          color: #a1a1aa;
          text-align: center;
          line-height: 1.5;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <span class="logo-box">FT</span> FyDry Task
        </div>
        {content}
        <div class="footer">
          FyDry Task — Organiza tus tareas, tranquiliza tu mente.<br>
          Este es un correo automático de seguridad. Si no solicitaste esta acción, puedes ignorar este mensaje.
        </div>
      </div>
    </body>
    </html>
    """


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email via Google SMTP (smtp.gmail.com)."""
    # Si no se han configurado credenciales de Google SMTP, imprimir en log para desarrollo
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD or "tu_correo" in settings.SMTP_USER:
        print("\n" + "=" * 60)
        print(f"[DEV EMAIL SIMULATOR] To: {to_email} | Subject: {subject}")
        print("HTML Content snippet:")
        print(html_content[:300] + "...\n" + "=" * 60)
        return True

    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        message["To"] = to_email

        html_part = MIMEText(html_content, "html", "utf-8")
        message.attach(html_part)

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            start_tls=settings.SMTP_TLS,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            timeout=10,
        )
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email} via Google SMTP: {exc}")
        print(f"[SMTP ERROR]: No se pudo enviar el correo a {to_email}: {exc}")
        return False


async def send_verification_otp_email(to_email: str, code: str, user_name: str = "Usuario"):
    """Sends 6-digit registration verification code."""
    content = f"""
    <h1>Verifica tu correo electrónico</h1>
    <p>Hola <strong>{escape(user_name)}</strong>,</p>
    <p>Gracias por unirte a FyDry Task. Para completar la creación de tu cuenta y proteger tus datos, ingresa el siguiente código de 6 dígitos:</p>
    <div class="otp-box">{code}</div>
    <p>Este código vencerá en {settings.OTP_EXPIRE_MINUTES} minutos.</p>
    """
    subject = f"{code} es tu código de verificación para FyDry Task"
    html = _get_base_html_template("Verificación de Correo - FyDry Task", content)
    return await send_email(to_email, subject, html)


async def send_login_otp_email(to_email: str, code: str, user_name: str = "Usuario"):
    """Sends 6-digit 2FA / login verification code."""
    content = f"""
    <h1>Código de acceso seguro</h1>
    <p>Hola <strong>{escape(user_name)}</strong>,</p>
    <p>Se ha solicitado un inicio de sesión en tu cuenta de FyDry Task. Utiliza el siguiente código para autenticarte:</p>
    <div class="otp-box">{code}</div>
    <p>El código expira en {settings.OTP_EXPIRE_MINUTES} minutos. Nunca compartas este código con nadie.</p>
    """
    subject = f"{code} es tu código de acceso a FyDry Task"
    html = _get_base_html_template("Acceso Seguro - FyDry Task", content)
    return await send_email(to_email, subject, html)


async def send_password_reset_email(to_email: str, code: str, user_name: str = "Usuario"):
    """Sends password reset code."""
    content = f"""
    <h1>Restablecimiento de contraseña</h1>
    <p>Hola <strong>{escape(user_name)}</strong>,</p>
    <p>Hemos recibido una solicitud para cambiar la contraseña de tu cuenta de FyDry Task. Ingresa el siguiente código en la pantalla de recuperación:</p>
    <div class="otp-box">{code}</div>
    <p>Si no fuiste tú quien solicitó este cambio, por favor ignora este mensaje y tu contraseña permanecerá segura.</p>
    """
    subject = f"{code} es tu código para restablecer tu contraseña"
    html = _get_base_html_template("Recuperar Contraseña - FyDry Task", content)
    return await send_email(to_email, subject, html)


async def send_account_locked_alert(to_email: str, user_name: str = "Usuario", minutes: int = 5):
    """Sends security notification when account is temporarily locked."""
    content = f"""
    <h1 style="color: #d97706;">Aviso de Seguridad: Acceso Congelado</h1>
    <p>Hola <strong>{escape(user_name)}</strong>,</p>
    <p>Hemos detectado múltiples intentos fallidos de inicio de sesión en tu cuenta. Por protección, el acceso ha sido bloqueado temporalmente durante <strong>{minutes} minutos</strong>.</p>
    <p>Si olvidaste tu contraseña, puedes restablecerla directamente desde la opción <em>¿Olvidaste tu contraseña?</em> en nuestra plataforma.</p>
    """
    subject = "Alerta de seguridad: Cuenta bloqueada temporalmente en FyDry Task"
    html = _get_base_html_template("Alerta de Seguridad - FyDry Task", content)
    return await send_email(to_email, subject, html)
