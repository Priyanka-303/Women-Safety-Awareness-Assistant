import re
from state import ConversationState, CareUnit
from classifier import classify_concern_with_gemini, get_care_unit_from_category

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
    state["user_concern"] = user_message
    category_str = classify_concern_with_gemini(user_message)
    state["category"] = category_str
    state["care_unit"] = get_care_unit_from_category(category_str)
    state["current_node"] = "care_unit"

    response = f"I understand. {FIELD_PROMPTS['user_name']}"
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
            state["awaiting_field"] = None
            state["current_node"] = "complete"

            care_unit = state.get("care_unit")
            user_concern = state.get("user_concern", "")

            if care_unit == "immediate_safety_response_unit":
                answer = f"'{user_concern}' : This situation may involve immediate safety risk. Please consider reaching out for urgent support or trusted help."
            elif care_unit == "emotional_support_unit":
                answer = f"'{user_concern}' : This sounds emotionally difficult. You are not alone, and emotional support is available."
            else:
                answer = f"'{user_concern}' : This appears to be a general wellbeing or awareness concern. Here is some guidance to help you stay informed and safe."

            state["answer"] = answer
            return state, answer
        else:
            return state, "I didn't quite catch that. Could you please share your age as a number?"

    return state, "I'm here to help. Could you tell me more about what's on your mind?"

def is_complete(state: ConversationState) -> bool:
    return (
        state.get("user_name") is not None
        and state.get("user_age") is not None
        and state.get("user_concern") is not None
    )
