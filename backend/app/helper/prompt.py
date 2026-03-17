import os, json
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI"))


def llm(user: dict) -> dict:
    prompt = f"""You are a risk detection agent for a job application platform.
Analyze this user for signs of fake accounts, spam, or suspicious activity.

User data:
- Username: {user['username']}
- Email: {user['email']}
- IP address: {user['ip_address']}
- Account age: {user['account_age_hours']} hours
- Messages sent: {user['message_count']}
- Posts made: {user['post_count']}
- Failed login attempts: {user['failed_logins']}

Context: This is a job platform. Suspicious patterns include:
mass-applying to jobs with identical messages, disposable emails,
very new accounts with high activity, shared IPs across multiple accounts,
and repeated failed logins.

Return ONLY valid JSON, no explanation, no markdown, no code fences:
{{
  "risk_score": <integer 0-100>,
  "risk_level": "<clean|medium|high>",
  "flag_reason": "<one sentence or null>",
  "signals": ["<signal1>", "<signal2>"]
}}

Scoring guide: 0-40 clean, 41-70 medium, 71-100 high risk.
Signals to consider: disposable_email, shared_ip, bot_behavior, spam_messages,
failed_logins, new_account, mass_applications"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())