import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from state import CareUnit
from config import get_settings

def classify_concern_with_gemini(user_concern: str) -> str:
    settings = get_settings()
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.2,
        google_api_key=settings.google_api_key
    )
    
    prompt = (
        "You are a helpful Women Safety & Awareness Assistant. "
        "Classify the concern below into one of the categories \n"
        "-Everyday_Wellbeing_Unit\n"
        "-Immediate_Safety_Response_Unit\n"
        "-Emotional_Support_Unit\n"
        f"Concern : {user_concern} \n"
        "Respond only with one word : "
        "Everyday_Wellbeing_Unit, Immediate_Safety_Response_Unit or Emotional_Support_Unit\n"
        "#Example : input : I want safety tips while traveling alone, Output : Everyday_Wellbeing_Unit"
    )

    response = llm.invoke([HumanMessage(content=prompt)])
    category = response.content.strip()
    return category

def get_care_unit_from_category(category: str) -> CareUnit:
    cat = category.lower()
    if "immediate" in cat:
        return "immediate_safety_response_unit"
    elif "emotional" in cat:
        return "emotional_support_unit"
    else:
        return "everyday_wellbeing_unit"
