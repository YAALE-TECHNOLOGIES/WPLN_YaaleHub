import re
import logging
import base64
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = "gpt-4o-mini"

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

def build_messages(questions: list[dict]) -> list:
    """
    Build the messages for OpenAI including text and images.
    """
    output_format = "\n".join(
        [f"Q{q['q_num']}: <marks_awarded>/{q['max_marks']}" for q in questions]
    )

    system_content = (
        "You are an English writing evaluator.\n\n"
        "Your task is to evaluate user answers based on the given questions (and images if provided) and assign marks.\n\n"
        "Instructions:\n"
        "- Each question has a maximum mark.\n"
        "- If an image is provided for a question, evaluate if the answer correctly refers to or describes the image if the prompt asks for it.\n"
        "- Evaluate based on clarity, grammar, relevance, and completeness.\n"
        "- IMPORTANT: If the User Answer is empty, strictly gibberish, or completely unrelated to the question, you MUST award 0 marks.\n"
        "- Do NOT give explanations.\n"
        "- Do NOT return breakdown.\n"
        "- ONLY return marks in the exact format shown below.\n\n"
        "Output Format:\n"
        f"{output_format}"
    )

    user_content = []
    user_content.append({"type": "text", "text": "Evaluate these questions and answers:\n\n"})

    for q in questions:
        q_text = (
            f"Q{q['q_num']} (Max Marks: {q['max_marks']}):\n"
            f"Instruction/Context: {q.get('context_text', '')}\n"
            f"Question: {q['question_text']}\n"
            f"User Answer: {q['user_answer']}\n"
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
                user_content.append({"type": "text", "text": "(Image was missing on server)\n\n"})
        else:
            user_content.append({"type": "text", "text": "\n"})

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content}
    ]

def parse_scores(response_text: str, questions: list[dict]) -> dict:
    scores = {}
    for q in questions:
        q_num = q["q_num"]
        pattern = rf"(?:Q|Question)\s*{q_num}\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*/\s*\d+"
        match = re.search(pattern, response_text, re.IGNORECASE)
        if match:
            obtained = float(match.group(1))
            scores[q_num] = min(obtained, float(q["max_marks"]))
        else:
            logger.warning(f"Could not parse score for Q{q_num} in AI response. Using 0.")
            scores[q_num] = 0.0
    return scores

def evaluate_writing(questions: list[dict]) -> dict:
    if not questions:
        return {"_total": 0.0}

    client = OpenAI(api_key=OPENAI_API_KEY)
    messages = build_messages(questions)

    logger.info(f"Sending {len(questions)} writing question(s) with vision support to OpenAI.")

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0,
            max_tokens=512,
        )
        raw = response.choices[0].message.content.strip()
        print(f"--- AI VISION EVALUATION RAW RESPONSE ---\n{raw}\n----------------------------------")
        logger.info(f"OpenAI raw response: {raw}")
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        raise RuntimeError(f"OpenAI evaluation failed: {e}")

    parsed = parse_scores(raw, questions)

    result = {}
    total = 0.0
    for q in questions:
        marks = parsed.get(q["q_num"], 0.0)
        result[q["question_id"]] = marks
        total += marks

    result["_total"] = total
    result["_raw_response"] = raw
    return result

