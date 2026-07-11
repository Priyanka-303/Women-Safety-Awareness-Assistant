from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from state import CareUnit
from config import get_settings

def classify_concern_with_gemini(user_concern: str) -> str:
    settings = get_settings()
    
    # Using OpenAI's basic, reliable GPT-3.5-turbo
    llm = ChatOpenAI(
        model="openai/gpt-3.5-turbo",  
        temperature=0.2,
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1"
    )
    
    prompt = (
        "You are a helpful Women Safety & Awareness Assistant. "
        "Classify the concern below into one of the categories:\n"
        "- Everyday_Wellbeing_Unit\n"
        "- Immediate_Safety_Response_Unit\n"
        "- Emotional_Support_Unit\n\n"
        f"Concern: {user_concern}\n"
        "Respond ONLY with one of these three exact category names. Do not add explanations.\n"
        "# Example Input: I want safety tips while traveling alone\n"
        "# Example Output: Everyday_Wellbeing_Unit"
    )

    response = llm.invoke([HumanMessage(content=prompt)])
    category = response.content.strip()
    
    # Clean up the response
    category = category.replace('"', '').replace("'", "").strip()
    
    return category

def get_care_unit_from_category(category: str) -> CareUnit:
    cat = category.lower()
    if "immediate" in cat:
        return "immediate_safety_response_unit"
    elif "emotional" in cat:
        return "emotional_support_unit"
    else:
        return "everyday_wellbeing_unit"
