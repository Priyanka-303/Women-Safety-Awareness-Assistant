from langgraph.graph import StateGraph, END
from state import ConversationState
from nodes import process_start, process_care_unit, is_complete

def start_node(state: ConversationState) -> ConversationState:
    # This is handled by process_start in our procedural flow
    return state

def classify_node(state: ConversationState) -> ConversationState:
    # This is handled by process_start
    return state

def build_graph() -> StateGraph:
    builder = StateGraph(ConversationState)
    
    # In the notebook, nodes are functions that return state
    # We've encapsulated the logic in nodes.py for the FastAPI integration
    
    builder.add_node("start", start_node)
    builder.set_entry_point("start")
    
    # ... (the actual logic is currently in main.py calling nodes.py)
    # To truly use LangGraph as in the notebook, we'd need to refactor nodes.py 
    # to be more 'node-like' (taking and returning full state).
    
    return builder.compile()

conversation_graph = build_graph()
