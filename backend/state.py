from typing import TypedDict, Literal, Optional

CareUnit = Literal["everyday_wellbeing_unit", "immediate_safety_response_unit", "emotional_support_unit"]

class ConversationState(TypedDict, total=False):
    session_id: str
    messages: list[dict]
    user_name: Optional[str]
    user_age: Optional[int]
    user_concern: Optional[str]
    care_unit: Optional[CareUnit]
    current_node: str
    webhook_sent: bool
    awaiting_field: Optional[str]
