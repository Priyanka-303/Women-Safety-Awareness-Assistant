from langgraph.graph import StateGraph, END
from state import ConversationState
from nodes import process_start, process_care_unit, is_complete

def start_node(state: ConversationState) -> ConversationState:
    return state

def router_node(state: ConversationState) -> ConversationState:
    return state

def care_unit_node(state: ConversationState) -> ConversationState:
    return state

def complete_node(state: ConversationState) -> ConversationState:
    state["current_node"] = "complete"
    return state

def route_after_router(state: ConversationState) -> str:
    if state.get("current_node") == "complete":
        return "complete"
    return "care_unit"

def route_after_care_unit(state: ConversationState) -> str:
    if is_complete(state):
        return "complete"
    return END

def build_graph() -> StateGraph:
    graph = StateGraph(ConversationState)
    
    graph.add_node("start", start_node)
    graph.add_node("router", router_node)
    graph.add_node("care_unit", care_unit_node)
    graph.add_node("complete", complete_node)
    
    graph.set_entry_point("start")
    graph.add_edge("start", "router")
    graph.add_conditional_edges("router", route_after_router, {"care_unit": "care_unit", "complete": "complete"})
    graph.add_conditional_edges("care_unit", route_after_care_unit, {"complete": "complete", END: END})
    graph.add_edge("complete", END)
    
    return graph.compile()

conversation_graph = build_graph()
