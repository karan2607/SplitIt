"""
Email helpers.

In development (no RESEND_API_KEY set) emails are printed to the console.
In production set RESEND_API_KEY and FROM_EMAIL in .env and they go through Resend.
"""
import os
import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'SplitIt <noreply@splitit.dev>')


def send_invite_email(*, to_email: str, invited_by_name: str, group_name: str, invite_url: str) -> None:
    subject = f"{invited_by_name} invited you to '{group_name}' on SplitIt"
    text_body = (
        f"Hi,\n\n"
        f"{invited_by_name} has invited you to join the group '{group_name}' on SplitIt.\n\n"
        f"Click the link below to accept the invitation:\n{invite_url}\n\n"
        f"This link expires in 72 hours.\n\n"
        f"— The SplitIt team"
    )

    if not RESEND_API_KEY:
        # Local dev fallback: print directly to console
        print(
            f"\n{'='*50}\n"
            f"INVITE EMAIL (no RESEND_API_KEY set)\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n\n"
            f"{text_body}\n"
            f"{'='*50}\n",
            flush=True,
        )
        return

    payload = json.dumps({
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }).encode()

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            logger.info("Invite email sent to %s (status %s)", to_email, resp.status)
    except urllib.error.HTTPError as exc:
        logger.error("Failed to send invite email to %s: %s", to_email, exc)
