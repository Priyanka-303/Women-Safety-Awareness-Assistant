import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEBHOOK_URL = process.env.WEBHOOK_URL!;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

type CareUnit =
  | "everyday_wellbeing_unit"
  | "immediate_safety_response_unit"
  | "emotional_support_unit";

interface ConversationState {
  session_id: string;
  messages: { role: string; content: string }[];
  user_name: string | null;
  user_age: number | null;
  user_concern: string | null;
  care_unit: CareUnit | null;
  current_node: string;
  webhook_sent: boolean;
  awaiting_field: string | null;
}

const FIELD_PROMPTS = {
  user_name:
    "May I know your name? You can use a nickname or alias if you prefer.",
  user_age:
    "Could you please share your age? This helps us provide appropriate support.",
  user_concern:
    "Could you tell me more about your situation or concern? Take your time.",
};

async function classifyConcern(message: string): Promise<CareUnit> {
  try {
    const prompt = `You are a helpful Women Safety & Awareness Assistant. 
Classify the concern below into one of the categories 
-Everyday_Wellbeing_Unit
-Immediate_Safety_Response_Unit
-Emotional_Support_Unit
Concern : ${message} 
Respond only with one word : 
Everyday_Wellbeing_Unit, Immediate_Safety_Response_Unit or Emotional_Support_Unit
#Example : input : I want safety tips while traveling alone, Output : Everyday_Wellbeing_Unit`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (text.includes("Immediate_Safety_Response_Unit")) {
      return "immediate_safety_response_unit";
    } else if (text.includes("Emotional_Support_Unit")) {
      return "emotional_support_unit";
    } else {
      return "everyday_wellbeing_unit";
    }
  } catch (error) {
    console.error("Classification error:", error);
    return "everyday_wellbeing_unit";
  }
}

function getFinalResponse(careUnit: CareUnit, userConcern: string): string {
  if (careUnit === "immediate_safety_response_unit") {
    return `'${userConcern}' : This situation may involve immediate safety risk. Please consider reaching out for urgent support or trusted help.`;
  } else if (careUnit === "emotional_support_unit") {
    return `'${userConcern}' : This sounds emotionally difficult. You are not alone, and emotional support is available.`;
  } else {
    return `'${userConcern}' : This appears to be a general wellbeing or awareness concern. Here is some guidance to help you stay informed and safe.`;
  }
}

function extractAge(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\b/);
  if (match) {
    const age = parseInt(match[1], 10);
    if (age >= 1 && age <= 120) {
      return age;
    }
  }
  return null;
}

async function processStart(
  state: ConversationState,
  userMessage: string
): Promise<{ state: ConversationState; response: string }> {
  const careUnit = await classifyConcern(userMessage);
  state.care_unit = careUnit;
  state.user_concern = userMessage;
  state.current_node = "care_unit";

  const response = `I understand. ${FIELD_PROMPTS.user_name}`;
  state.awaiting_field = "user_name";

  return { state, response };
}

function processCareUnit(
  state: ConversationState,
  userMessage: string
): { state: ConversationState; response: string } {
  const awaiting = state.awaiting_field;

  if (awaiting === "user_name") {
    state.user_name = userMessage.trim();
    state.awaiting_field = "user_age";
    return { state, response: FIELD_PROMPTS.user_age };
  }

  if (awaiting === "user_age") {
    const age = extractAge(userMessage);
    if (age) {
      state.user_age = age;
      state.awaiting_field = null;
      state.current_node = "complete";
      return {
        state,
        response: getFinalResponse(state.care_unit!, state.user_concern!),
      };
    } else {
      return {
        state,
        response:
          "I didn't quite catch that. Could you please share your age as a number?",
      };
    }
  }

  return {
    state,
    response: "I'm here to help. Could you tell me more about what's on your mind?",
  };
}

function isComplete(state: ConversationState): boolean {
  return (
    state.user_name !== null &&
    state.user_age !== null &&
    state.user_concern !== null
  );
}

async function sendWebhook(state: ConversationState): Promise<boolean> {
  const payload = {
    user_name: state.user_name,
    user_age: state.user_age,
    user_concern: state.user_concern,
    care_unit: state.care_unit,
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getConversation(
  sessionId: string
): Promise<ConversationState | null> {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("session_id", sessionId)
    .single();
  return data;
}

async function saveConversation(state: ConversationState): Promise<void> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("session_id", state.session_id)
    .single();

  if (existing) {
    await supabase
      .from("conversations")
      .update({
        user_name: state.user_name,
        user_age: state.user_age,
        user_concern: state.user_concern,
        care_unit: state.care_unit,
        messages: state.messages,
        webhook_sent: state.webhook_sent,
        current_node: state.current_node,
        awaiting_field: state.awaiting_field,
      })
      .eq("session_id", state.session_id);
  } else {
    await supabase.from("conversations").insert({
      session_id: state.session_id,
      user_name: state.user_name,
      user_age: state.user_age,
      user_concern: state.user_concern,
      care_unit: state.care_unit,
      messages: state.messages,
      webhook_sent: state.webhook_sent,
      current_node: state.current_node,
      awaiting_field: state.awaiting_field,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, session_id } = body;

    const sessionId = session_id || crypto.randomUUID();

    const existing = await getConversation(sessionId);

    let state: ConversationState;

    if (existing) {
      state = {
        session_id: sessionId,
        messages: existing.messages || [],
        user_name: existing.user_name,
        user_age: existing.user_age,
        user_concern: existing.user_concern,
        care_unit: existing.care_unit,
        current_node: existing.current_node || "start",
        webhook_sent: existing.webhook_sent || false,
        awaiting_field: existing.awaiting_field,
      };
    } else {
      state = {
        session_id: sessionId,
        messages: [],
        user_name: null,
        user_age: null,
        user_concern: null,
        care_unit: null,
        current_node: "start",
        webhook_sent: false,
        awaiting_field: null,
      };
    }

    state.messages.push({ role: "user", content: message });

    let response: string;
    if (state.current_node === "start") {
      const result = await processStart(state, message);
      state = result.state;
      response = result.response;
    } else {
      const result = processCareUnit(state, message);
      state = result.state;
      response = result.response;
    }

    state.messages.push({ role: "assistant", content: response });

    const complete = isComplete(state);

    if (complete && !state.webhook_sent) {
      const webhookSuccess = await sendWebhook(state);
      state.webhook_sent = webhookSuccess;
    }

    await saveConversation(state);

    return NextResponse.json({
      response,
      session_id: sessionId,
      care_unit: state.care_unit,
      is_complete: complete,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
