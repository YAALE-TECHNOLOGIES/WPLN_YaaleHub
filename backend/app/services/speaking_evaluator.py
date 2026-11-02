"""
Speaking Evaluation Service
Step 1 – Transcribe audio with OpenAI gpt-4o-mini-transcribe
Step 2 – Evaluate transcribed text with GPT-4o Mini (same logic as writing)
"""
import re
import os
import base64
import logging
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
EVALUATION_MODEL = "gpt-4o-mini"
def encode_image(image_path):
    """Encodes a local image to base64 string."""
    try:
        if not os.path.exists(image_path):
            return None
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"Error encoding image {image_path}: {e}")
        return None

def is_image(url):
    if not url: return False
    return any(url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])


# ──────────────────────────────────────────────────────────────────────────────
# Step 1 – Transcription
# ──────────────────────────────────────────────────────────────────────────────

def transcribe_audio(audio_path: str) -> str:
    """
    Transcribe an audio file (mp3/wav/webm/m4a) using OpenAI's
    gpt-4o-mini-transcribe model.

    Returns the transcribed text as a string.
    """
    client = OpenAI(api_key=OPENAI_API_KEY)

    logger.info(f"Transcribing audio file: {audio_path}")
    try:
        with open(audio_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model=TRANSCRIPTION_MODEL,
                file=audio_file,
                response_format="text",
            )
        # response is a plain string when response_format="text"
        text = response.strip() if isinstance(response, str) else response.text.strip()
        logger.info(f"Transcription complete ({len(text)} chars)")
        return text
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise RuntimeError(f"Audio transcription failed: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# Step 2 – Evaluation prompt builder
# ──────────────────────────────────────────────────────────────────────────────

def build_speaking_prompt_messages(questions: list[dict]) -> list:
    """
    Build the speaking evaluation prompt with vision support.
    """
    output_format = "\n".join(
        [f"Q{q['q_num']}: <marks_awarded>/{q['max_marks']}" for q in questions]
    )

    system_content = (
        "You are an English speaking evaluator.\n\n"
        "Your task is to evaluate user answers based on the given questions and assign marks.\n\n"
        "Instructions:\n"
        "- Each question has a maximum mark.\n"
        "- Evaluate the answer based on clarity, grammar, pronunciation (inferred from text), "
        "relevance, and completeness.\n"
        "- IMPORTANT: If the Answer is empty, strictly gibberish, or completely unrelated to the question, you MUST award 0 marks.\n"
        "- If an image is provided, evaluate if the answer correctly refers to or describes the image if relevant.\n"
        "- Do NOT give explanations.\n"
        "- Do NOT return breakdown.\n"
        "- ONLY return marks in the exact format shown below.\n\n"
        "Output Format:\n"
        f"{output_format}"
    )

    user_content = []
    user_content.append({"type": "text", "text": "Evaluate these speaking questions and answers:\n\n"})

    for q in questions:
        q_text = (
            f"Q{q['q_num']} (Max Marks: {q['max_marks']}):\n"
            f"Instruction/Context: {q.get('context_text', '')}\n"
            f"Question: {q['question_text']}\n"
            f"Answer: {q['transcribed_text']}\n"
        )
        user_content.append({"type": "text", "text": q_text})
        
        # Add image if exists
        if q.get('media_url') and is_image(q['media_url']):
            base64_image = encode_image(q['media_url'])
            if base64_image:
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                })
                user_content.append({"type": "text", "text": f"(Visual prompt for Q{q['q_num']} shown above)\n\n"})
        else:
            user_content.append({"type": "text", "text": "\n"})

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content}
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Step 3 – Parse GPT scores
# ──────────────────────────────────────────────────────────────────────────────

def parse_speaking_scores(response_text: str, questions: list[dict]) -> dict:
    """
    Parse GPT response like:
      Q1: 7/10
      Q2: 2/3
    Returns {q_num: marks_obtained}
    """
    scores = {}
    for q in questions:
        q_num = q["q_num"]
        pattern = rf"(?:Q|Question)\s*{q_num}\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*/\s*\d+"
        match = re.search(pattern, response_text, re.IGNORECASE)
        if match:
            obtained = float(match.group(1))
            scores[q_num] = min(obtained, float(q["max_marks"]))
        else:
            logger.warning(f"Could not parse speaking score for Q{q_num}. Using 0.")
            scores[q_num] = 0.0
    return scores


# ──────────────────────────────────────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────────────────────────────────────

def evaluate_speaking(questions: list[dict]) -> dict:
    """
    Evaluate speaking answers that have already been transcribed.

    questions: list of dicts with keys:
        q_num          – sequential question number (1-based)
        question_id    – DB primary key of the Question row
        question_text  – the question text
        transcribed_text – text returned by transcription step
        max_marks      – integer max marks for this question

    Returns:"""  """
        {question_id: marks_obtained, '_total': total, '_raw_response': str}
    """
    if not questions:
        return {"_total": 0.0, "_raw_response": ""}

    client = OpenAI(api_key=OPENAI_API_KEY)
    messages = build_speaking_prompt_messages(questions)

    logger.info(f"Sending {len(questions)} speaking question(s) with vision support to OpenAI.")

    try:
        response = client.chat.completions.create(
            model=EVALUATION_MODEL,
            messages=messages,
            temperature=0,
            max_tokens=256,
        )
        raw = response.choices[0].message.content.strip()
        print(f"--- AI SPEAKING EVALUATION RESPONSE ---\n{raw}\n---------------------------------------")
        logger.info(f"OpenAI speaking eval raw response: {raw}")
    except Exception as e:
        logger.error(f"OpenAI speaking evaluation API error: {e}")
        raise RuntimeError(f"OpenAI speaking evaluation failed: {e}")

    parsed = parse_speaking_scores(raw, questions)

    result = {}
    total = 0.0
    for q in questions:
        marks = parsed.get(q["q_num"], 0.0)
        result[q["question_id"]] = marks
        total += marks

    result["_total"] = total
    result["_raw_response"] = raw
    return result
