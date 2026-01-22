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
  webhook_sent: boolean;
}

async function classifyConcern(message: string): Promise<CareUnit> {
  try {
    const prompt = `You are a helpful Women Safety & Awareness Assistant. 
Classify the concern below into one of the categories:
- Everyday_Wellbeing_Unit: General safety tips, travel advice, non-urgent queries.
- Immediate_Safety_Response_Unit: Physical danger, stalking, harassment in progress, medical emergencies.
- Emotional_Support_Unit: Harassment experiences, trauma, anxiety, needing someone to talk to.

Concern: ${message} 

Respond only with one word: Everyday_Wellbeing_Unit, Immediate_Safety_Response_Unit, or Emotional_Support_Unit.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().toLowerCase();

    if (text.includes("immediate")) return "immediate_safety_response_unit";
    if (text.includes("emotional")) return "emotional_support_unit";
    return "everyday_wellbeing_unit";
  } catch (error) {
    console.error("Classification error:", error);
    return "everyday_wellbeing_unit";
  }
}

async function generateAIResponse(state: ConversationState, isSos: boolean, location?: any) {
  const history = state.messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  
  let systemPrompt = `You are a compassionate, professional Women Safety & Awareness Assistant. 
Your goal is to provide safety guidance, emotional support, and practical advice.
Be direct but empathetic. If the user is in danger, prioritize safety steps (e.g., "go to a public place", "call emergency services").
Keep your responses relatively concise.
Current Care Unit: ${state.care_unit || 'Unknown'}`;

  if (isSos) {
    systemPrompt += `\nCRITICAL: AN SOS HAS BEEN TRIGGERED. 
Location provided: ${location ? JSON.stringify(location) : 'No location access'}.
Confirm that help is being notified and provide immediate survival/safety steps. 
Do not ask questions, just provide immediate safety instructions.`;
  }

  const prompt = `${systemPrompt}\n\nRecent Conversation:\n${history}\n\nAssistant:`;
  
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function sendWebhook(state: ConversationState, isSos: boolean = false, location?: any): Promise<boolean> {
  const payload = {
    user_name: state.user_name,
    user_age: state.user_age,
    user_concern: state.user_concern || (state.messages.length > 0 ? state.messages[0].content : "No concern provided"),
    care_unit: state.care_unit,
    is_sos: isSos,
    location: location,
    timestamp: new Date().toISOString()
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

async function getConversation(sessionId: string): Promise<ConversationState | null> {
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

  const dataToSave = {
    session_id: state.session_id,
    user_name: state.user_name,
    user_age: state.user_age,
    user_concern: state.user_concern,
    care_unit: state.care_unit,
    messages: state.messages,
    webhook_sent: state.webhook_sent,
  };

  if (existing) {
    await supabase.from("conversations").update(dataToSave).eq("session_id", state.session_id);
  } else {
    await supabase.from("conversations").insert(dataToSave);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, session_id, is_sos, location } = body;

    const sessionId = session_id || crypto.randomUUID();
    const existing = await getConversation(sessionId);

    let state: ConversationState = existing ? {
      session_id: sessionId,
      messages: existing.messages || [],
      user_name: existing.user_name,
      user_age: existing.user_age,
      user_concern: existing.user_concern,
      care_unit: existing.care_unit as CareUnit,
      webhook_sent: existing.webhook_sent || false,
    } : {
      session_id: sessionId,
      messages: [],
      user_name: null,
      user_age: null,
      user_concern: null,
      care_unit: null,
      webhook_sent: false,
    };

    state.messages.push({ role: "user", content: message });

    // Classify if not already classified or if it's the first message
    if (!state.care_unit || state.messages.length <= 2) {
      state.care_unit = await classifyConcern(message);
      state.user_concern = state.user_concern || message;
    }

    let response: string;
    if (is_sos) {
      response = "⚠️ SOS ALERT ACTIVATED. Emergency contacts and support services are being notified. Please stay calm. If you can, move to a safe, public area. Help is on the way.";
      state.webhook_sent = await sendWebhook(state, true, location);
    } else {
      response = await generateAIResponse(state, false);
      
      // Send webhook for certain care units if not already sent
      if (!state.webhook_sent && (state.care_unit === "immediate_safety_response_unit" || state.care_unit === "emotional_support_unit")) {
        state.webhook_sent = await sendWebhook(state);
      }
    }

    state.messages.push({ role: "assistant", content: response });
    await saveConversation(state);

    return NextResponse.json({
      response,
      session_id: sessionId,
      care_unit: state.care_unit,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

