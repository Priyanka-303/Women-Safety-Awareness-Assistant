import re
from state import ConversationState, CareUnit
from classifier import classify_concern

UNIT_RESPONSES = {
    "everyday_wellbeing_unit": {
        "greeting": "Thank you for reaching out. I'm here to help with general wellbeing, health awareness, and everyday safety guidance.",
        "complete": "Thank you for sharing this information. Your concern has been noted and our Everyday Wellbeing team will provide guidance shortly. Remember, you deserve to feel safe and informed every day.",
    },
    "immediate_safety_response_unit": {
        "greeting": "I understand you may be in a concerning situation. Your safety is the priority. I'm here to help connect you with immediate support.",
        "complete": "Your information has been received by our Immediate Safety Response team. If you are in immediate danger, please contact local emergency services. Help is on the way.",
    },
    "emotional_support_unit": {
        "greeting": "I hear you, and I want you to know that your feelings are valid. I'm here to listen and connect you with emotional support.",
        "complete": "Thank you for trusting us with your feelings. Our Emotional Support team has received your information and will reach out with care and understanding. You are not alone.",
    },
}

FIELD_PROMPTS = {
    "user_name": "May I know your name? You can use a nickname or alias if you prefer.",
    "user_age": "Could you please share your age? This helps us provide appropriate support.",
    "user_concern": "Could you tell me more about your situation or concern? Take your time.",
}

def extract_age(text: str) -> int | None:
    match = re.search(r'\b(\d{1,3})\b', text)
    if match:
        age = int(match.group(1))
        if 1 <= age <= 120:
            return age
    return None

def process_start(state: ConversationState, user_message: str) -> tuple[ConversationState, str]:
    care_unit = classify_concern(user_message)
    state["care_unit"] = care_unit
    state["user_concern"] = user_message
    state["current_node"] = "care_unit"
    
    greeting = UNIT_RESPONSES[care_unit]["greeting"]
    response = f"{greeting}\n\n{FIELD_PROMPTS['user_name']}"
    state["awaiting_field"] = "user_name"
    
    return state, response

def process_care_unit(state: ConversationState, user_message: str) -> tuple[ConversationState, str]:
    awaiting = state.get("awaiting_field")
    
    if awaiting == "user_name":
        state["user_name"] = user_message.strip()
        state["awaiting_field"] = "user_age"
        return state, FIELD_PROMPTS["user_age"]
    
    elif awaiting == "user_age":
        age = extract_age(user_message)
        if age:
            state["user_age"] = age
            if state.get("user_concern"):
                state["awaiting_field"] = None
                state["current_node"] = "complete"
                return state, UNIT_RESPONSES[state["care_unit"]]["complete"]
            else:
                state["awaiting_field"] = "user_concern"
                return state, FIELD_PROMPTS["user_concern"]
        else:
            return state, "I didn't quite catch that. Could you please share your age as a number?"
    
    elif awaiting == "user_concern":
        state["user_concern"] = user_message
        state["awaiting_field"] = None
        state["current_node"] = "complete"
        return state, UNIT_RESPONSES[state["care_unit"]]["complete"]
    
    return state, "I'm here to help. Could you tell me more about what's on your mind?"

def get_missing_fields(state: ConversationState) -> list[str]:
    missing = []
    if not state.get("user_name"):
        missing.append("user_name")
    if not state.get("user_age"):
        missing.append("user_age")
    if not state.get("user_concern"):
        missing.append("user_concern")
    return missing

def is_complete(state: ConversationState) -> bool:
    return (
        state.get("user_name") is not None
        and state.get("user_age") is not None
        and state.get("user_concern") is not None
    )
