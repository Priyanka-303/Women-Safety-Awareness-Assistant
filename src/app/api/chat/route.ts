import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEBHOOK_URL = process.env.WEBHOOK_URL!;

const IMMEDIATE_SAFETY_KEYWORDS =
  /\b(danger|threat|harass|abuse|violen|stalk|unsafe|attack|assault|beat|hit|hurt|rape|kidnap|follow|scare|fear\s+for\s+my\s+life|emergency|help\s+me|someone\s+is|being\s+followed|domestic)\b/i;

const EMOTIONAL_SUPPORT_KEYWORDS =
  /\b(depress|anxious|anxiety|trauma|stress|mental|emotional|sad|cry|overwhelm|panic|afraid|lonely|hopeless|suicid|self.harm|worried|nervous|upset|feeling\s+down|can't\s+cope|breakdown)\b/i;

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

const UNIT_RESPONSES: Record<
  CareUnit,
  { greeting: string; complete: string }
> = {
  everyday_wellbeing_unit: {
    greeting:
      "Thank you for reaching out. I'm here to help with general wellbeing, health awareness, and everyday safety guidance.",
    complete:
      "Thank you for sharing this information. Your concern has been noted and our Everyday Wellbeing team will provide guidance shortly. Remember, you deserve to feel safe and informed every day.",
  },
  immediate_safety_response_unit: {
    greeting:
      "I understand you may be in a concerning situation. Your safety is the priority. I'm here to help connect you with immediate support.",
    complete:
      "Your information has been received by our Immediate Safety Response team. If you are in immediate danger, please contact local emergency services. Help is on the way.",
  },
  emotional_support_unit: {
    greeting:
      "I hear you, and I want you to know that your feelings are valid. I'm here to listen and connect you with emotional support.",
    complete:
      "Thank you for trusting us with your feelings. Our Emotional Support team has received your information and will reach out with care and understanding. You are not alone.",
  },
};

const FIELD_PROMPTS = {
  user_name:
    "May I know your name? You can use a nickname or alias if you prefer.",
  user_age:
    "Could you please share your age? This helps us provide appropriate support.",
  user_concern:
    "Could you tell me more about your situation or concern? Take your time.",
};

function classifyConcern(message: string): CareUnit {
  if (IMMEDIATE_SAFETY_KEYWORDS.test(message)) {
    return "immediate_safety_response_unit";
  }
  if (EMOTIONAL_SUPPORT_KEYWORDS.test(message)) {
    return "emotional_support_unit";
  }
  return "everyday_wellbeing_unit";
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

function processStart(
  state: ConversationState,
  userMessage: string
): { state: ConversationState; response: string } {
  const careUnit = classifyConcern(userMessage);
  state.care_unit = careUnit;
  state.user_concern = userMessage;
  state.current_node = "care_unit";

  const greeting = UNIT_RESPONSES[careUnit].greeting;
  const response = `${greeting}\n\n${FIELD_PROMPTS.user_name}`;
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
      if (state.user_concern) {
        state.awaiting_field = null;
        state.current_node = "complete";
        return { state, response: UNIT_RESPONSES[state.care_unit!].complete };
      } else {
        state.awaiting_field = "user_concern";
        return { state, response: FIELD_PROMPTS.user_concern };
      }
    } else {
      return {
        state,
        response:
          "I didn't quite catch that. Could you please share your age as a number?",
      };
    }
  }

  if (awaiting === "user_concern") {
    state.user_concern = userMessage;
    state.awaiting_field = null;
    state.current_node = "complete";
    return { state, response: UNIT_RESPONSES[state.care_unit!].complete };
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
      const result = processStart(state, message);
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
