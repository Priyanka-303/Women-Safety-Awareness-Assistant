"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Shield, 
  Heart, 
  AlertCircle, 
  Users, 
  Settings, 
  MapPin, 
  PhoneCall,
  X,
  Plus,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [careUnit, setCareUnit] = useState<string | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [isSOSLoading, setIsSOSLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load emergency contacts from local storage
    const saved = localStorage.getItem("emergency_contacts");
    if (saved) {
      setEmergencyContacts(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("emergency_contacts", JSON.stringify(emergencyContacts));
  }, [emergencyContacts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("https://women-safety-awareness-assistant-2.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, session_id: sessionId }),
      });

      const data = await response.json();
      setSessionId(data.session_id);
      setCareUnit(data.care_unit);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      toast.error("Connection error. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I apologize, but I'm having trouble connecting right now. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSOS = async () => {
    setIsSOSLoading(true);
    toast.info("Triggering SOS alert...");

    try {
      // Get location if possible
      let location = null;
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
        } catch (err) {
          console.warn("Location access denied", err);
        }
      }

      const response = await fetch("https://women-safety-awareness-assistant-2.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: "SOS EMERGENCY TRIGGERED", 
          session_id: sessionId,
          is_sos: true,
          location
        }),
      });

      if (response.ok) {
        toast.success("Emergency contacts and support services have been notified.");
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "⚠️ SOS ALERT ACTIVATED. Help is being notified. Please stay where you are if it's safe, or move to a crowded area. I'm staying with you." 
        }]);
      } else {
        throw new Error("SOS failed");
      }
    } catch {
      toast.error("Failed to send SOS. Please call emergency services directly.");
    } finally {
      setIsSOSLoading(false);
    }
  };

  const addContact = () => {
    if (!newContactName || !newContactPhone) return;
    const newContact: EmergencyContact = {
      id: crypto.randomUUID(),
      name: newContactName,
      phone: newContactPhone
    };
    setEmergencyContacts([...emergencyContacts, newContact]);
    setNewContactName("");
    setNewContactPhone("");
    toast.success("Contact added");
  };

  const removeContact = (id: string) => {
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id));
    toast.info("Contact removed");
  };

  const getCareUnitLabel = (unit: string | null) => {
    switch (unit) {
      case "everyday_wellbeing_unit":
        return { label: "Everyday Wellbeing", icon: <Heart className="w-3 h-3 mr-1" /> };
      case "immediate_safety_response_unit":
        return { label: "Immediate Safety", icon: <Shield className="w-3 h-3 mr-1" /> };
      case "emotional_support_unit":
        return { label: "Emotional Support", icon: <AlertCircle className="w-3 h-3 mr-1" /> };
      default:
        return null;
    }
  };

  const unitInfo = getCareUnitLabel(careUnit);

  return (
    <div className="flex flex-col h-screen bg-[#FDFCFD]">
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Shield className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                Safety Assistant
              </h1>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Always Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unitInfo && (
              <span className="hidden md:flex items-center text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full font-medium border border-purple-100">
                {unitInfo.icon}
                {unitInfo.label}
              </span>
            )}
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-500">
                  <Users className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Emergency Contacts</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Input 
                        placeholder="Contact Name" 
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                      />
                      <Input 
                        placeholder="Phone Number" 
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                      />
                      <Button onClick={addContact} className="bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-4 h-4 mr-2" /> Add Contact
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Your Contacts</h3>
                    {emergencyContacts.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No contacts added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {emergencyContacts.map(contact => (
                          <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                              <p className="text-xs text-gray-500">{contact.phone}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeContact(contact.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Button 
              variant="destructive" 
              className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 font-bold px-6"
              onClick={handleSOS}
              disabled={isSOSLoading}
            >
              {isSOSLoading ? "..." : "SOS"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-purple-50 rounded-3xl flex items-center justify-center mx-auto relative z-10">
                  <Heart className="w-12 h-12 text-purple-600 fill-purple-200" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center animate-bounce">
                  <Shield className="w-4 h-4 text-pink-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  How can I help you today?
                </h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  I'm your AI companion dedicated to your safety and wellbeing. Everything we discuss is confidential.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto mt-8">
                {[
                  "I'm traveling alone and feel uneasy",
                  "I need some quick safety tips",
                  "I'd like to share an experience",
                  "Help me setup my emergency circle"
                ].map((tip) => (
                  <button
                    key={tip}
                    onClick={() => {
                      setInput(tip);
                    }}
                    className="p-4 bg-white border border-gray-100 rounded-2xl text-sm text-left font-medium text-gray-700 hover:border-purple-200 hover:bg-purple-50 transition-all shadow-sm"
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-5 py-4 rounded-2xl ${
                  message.role === "user"
                    ? "bg-purple-600 text-white rounded-tr-none shadow-md"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-none leading-relaxed"
                }`}
              >
                <p className="whitespace-pre-wrap text-[15px]">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-purple-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <div
                    className="w-2 h-2 bg-purple-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white border-t border-gray-100 p-4 pb-8 md:pb-4">
        <form 
          onSubmit={sendMessage} 
          className="max-w-3xl mx-auto flex items-end gap-3"
        >
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your concern here..."
              rows={1}
              className="w-full pl-5 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all text-[15px] resize-none overflow-hidden"
              style={{ minHeight: '56px', maxHeight: '160px' }}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 bottom-2 w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-md disabled:opacity-30"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </form>
        <div className="max-w-3xl mx-auto mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <Shield className="w-3 h-3 mr-1" /> End-to-End Private
          </div>
          <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <MapPin className="w-3 h-3 mr-1" /> SOS Ready
          </div>
        </div>
      </footer>
    </div>
  );
}
