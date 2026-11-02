import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "localhost") # Mocked by default
SMTP_PORT = os.getenv("SMTP_PORT", 1025)
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

def send_notification(to_email, subject, body):
    # This is a sample implementation. In production, use real SMTP settings or a library like fastapi-mail.
    # To test locally during dev, use 'python -m smtpd -n -c DebuggingServer localhost:1025'
    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg['Subject'] = subject
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        
        with smtplib.SMTP(SMTP_SERVER, int(SMTP_PORT)) as s:
            s.starttls()
            if SMTP_USER: 
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        
        print(f"Email Sent Successfully To: {to_email} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
