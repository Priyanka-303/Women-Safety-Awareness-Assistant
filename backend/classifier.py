import re
from state import CareUnit

IMMEDIATE_SAFETY_KEYWORDS = [
    r"\b(danger|threat|harass|abuse|violen|stalk|unsafe|attack|assault|beat|hit|hurt|rape|kidnap|follow|scare|fear\s+for\s+my\s+life|emergency|help\s+me|someone\s+is|being\s+followed|domestic)\b",
]

EMOTIONAL_SUPPORT_KEYWORDS = [
    r"\b(depress|anxious|anxiety|trauma|stress|mental|emotional|sad|cry|overwhelm|panic|afraid|lonely|hopeless|suicid|self.harm|worried|nervous|upset|feeling\s+down|can't\s+cope|breakdown)\b",
]

def classify_concern(message: str) -> CareUnit:
    text = message.lower()
    
    for pattern in IMMEDIATE_SAFETY_KEYWORDS:
        if re.search(pattern, text, re.IGNORECASE):
            return "immediate_safety_response_unit"
    
    for pattern in EMOTIONAL_SUPPORT_KEYWORDS:
        if re.search(pattern, text, re.IGNORECASE):
            return "emotional_support_unit"
    
    return "everyday_wellbeing_unit"
