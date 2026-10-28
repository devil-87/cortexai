import {
  Mic,
  Paperclip,
  Send,
  Zap,
  MessageSquare,
  Code2,
  FileText,
  Presentation,
  Image as ImageIcon,
  Globe,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import sendMessage from "../features/sendMessage.js";
import getCurrentUser from "../features/getCurrentUser.js"; // ADDED
import { createConversation } from "../features/createConversation.js";
import { useDispatch, useSelector } from "react-redux";
import { addMessage, setMessages, setArtifacts } from "../redux/messageSlice.js";
import { setCredits, setUserdata } from "../redux/userSlice.js"; // ADDED
import {
  addConversation,
  setSelectedConversation,
  updateConversationTitle,
} from "../redux/conversationSlice.js";

// Agent options shown as pills above the input.
const agents = [
  { id: "auto", icon: Zap, label: "Auto" },
  { id: "chat", icon: MessageSquare, label: "Chat" },
  { id: "coding", icon: Code2, label: "Coding" },
  { id: "pdf", icon: FileText, label: "PDF" },
  { id: "ppt", icon: Presentation, label: "PPT" },
  { id: "vision", icon: ImageIcon, label: "Vision" },
  { id: "search", icon: Globe, label: "Search" },
];

// Pull the AI text out of whatever shape the backend returns
const extractReply = (data) => {
  if (typeof data === "string") return data;
  return (
    data?.response ||
    data?.aiResponse ||
    data?.content ||
    data?.message ||
    data?.answer ||
    data?.reply ||
    data?.text ||
    ""
  );
};

const extractImages = (data) => {
  if (!data || typeof data === "string") return [];
  return Array.isArray(data.images) ? data.images : [];
};

const extractArtifacts = (data) => {
  if (!data || typeof data === "string") return [];
  return Array.isArray(data.artifacts) ? data.artifacts : [];
};

const ChatInput = () => {
  const [value, setValue] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Auto");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const dispatch = useDispatch();
  const { selectedConversation } = useSelector((state) => state.conversation);
  const { messages } = useSelector((state) => state.message);

  // No chat needs to be selected: a new one is created automatically
  const canSend = value.trim() && !sending;

  // The textarea grows with the text (up to a limit) and shrinks back when cleared
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // ADDED: reload the user from the server (used when a request failed after
  // credits may already have been spent, so the screen shows the real balance)
  const refreshUser = async () => {
    const user = await getCurrentUser();
    if (user) dispatch(setUserdata(user));
  };

  const handleSendMessage = async () => {
    if (!canSend) return;

    const prompt = value.trim();
    setValue("");
    setSending(true);

    let conversation = selectedConversation;
    const isNewChat = !conversation?._id;

    // The first message of a chat: the backend will write a title for it
    const isFirstMessage =
      isNewChat ||
      (conversation.title === "New Chat" && (messages?.length ?? 0) === 0);

    const userMessage = {
      _id: `temp-user-${Date.now()}`,
      conversationId: conversation?._id ?? null,
      role: "user",
      content: prompt,
    };

    // 1. Show the user's message instantly
    dispatch(addMessage(userMessage));

    // 2. New chat: create it in the background
    if (isNewChat) {
      try {
        const created = await createConversation();
        conversation = created?.conversation ?? created;
        if (!conversation?._id) throw new Error("No conversation returned");
      } catch (err) {
        console.error("Failed to create conversation:", err);
        dispatch(setMessages([]));
        setValue(prompt);
        setSending(false);
        return;
      }

      dispatch(
        setMessages([{ ...userMessage, conversationId: conversation._id }]),
      );
      dispatch(addConversation(conversation));
      dispatch(setSelectedConversation(conversation));
    }

    const conversationId = conversation._id;

    try {
      // 3. Ask the backend
      const payload = {
        prompt,
        conversationId,
        isFirstMessage,
        agent: selectedAgent.toLowerCase(),
      };
      const data = await sendMessage(payload);
      console.log("sendMessage response:", data);

      // 4. Show the AI reply with its images and artifacts
      // CHANGED: 402 means the user has no credits left
      const reply =
        data?.status === 402
          ? "You are out of credits. Click the coin icon in the sidebar to open Billing and add more."
          : data?.error
          ? `Error: ${data.error}`
          : extractReply(data);
      const images = extractImages(data);
      const artifacts = extractArtifacts(data);

      dispatch(
        addMessage({
          _id: `temp-ai-${Date.now()}`,
          conversationId,
          role: "assistant",
          content: reply || "No response received.",
          images,
          artifacts,
        }),
      );

      if (artifacts.length > 0) {
        dispatch(setArtifacts(artifacts));
      }

      // 5. Show the new title in the sidebar
      if (data?.title) {
        dispatch(
          updateConversationTitle({ id: conversationId, title: data.title }),
        );
      }

      // 6. ADDED: update the credits on screen, no page refresh needed
      if (data?.credits !== undefined) {
        // normal case: the backend sent the new balance
        dispatch(setCredits(data.credits));
      } else if (data?.error && data.status !== 402) {
        // the request failed, but credits may already have been spent: reload them
        refreshUser();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      dispatch(
        addMessage({
          _id: `temp-error-${Date.now()}`,
          conversationId,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          images: [],
          artifacts: [],
        }),
      );
    } finally {
      setSending(false);
    }
  };

  // Enter sends, Shift+Enter makes a new line
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 md:px-5 pt-2 sm:pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-white/[0.06] bg-[#0d0f14]">
      <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto bg-white/[0.03] border border-white/[0.07] rounded-2xl px-3 sm:px-4 pt-2.5 sm:pt-3.5 pb-2 sm:pb-3">
        {/* Agent pills: one swipeable row on phones, wrap on larger screens */}
        <div className="flex w-full gap-1.5 sm:gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {agents.map((agent) => {
            const isActive = selectedAgent === agent.label;
            const Icon = agent.icon;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgent(agent.label)}
                className={`shrink-0 cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_1px_8px_rgba(99,102,241,.35)]"
                    : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.07]"
                }`}
              >
                <Icon
                  size={13}
                  className={isActive ? "text-white" : "text-slate-500"}
                />
                {agent.label}
              </button>
            );
          })}
        </div>

        {/* 16px on phones stops iOS from zooming in on focus */}
        <textarea
          ref={textareaRef}
          placeholder="Ask Anything..."
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          value={value}
          rows={1}
          className="w-full bg-transparent outline-none resize-none text-base sm:text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed min-h-[2.5rem] sm:min-h-[3.5rem] max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Attach file"
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer"
            >
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              aria-label="Voice input"
              className="flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer"
            >
              <Mic size={16} />
            </button>
          </div>
          <button
            type="button"
            aria-label="Send message"
            disabled={!canSend}
            onClick={handleSendMessage}
            className={`flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-lg border-none transition-all duration-150 ${
              canSend
                ? "bg-linear-to-br from-indigo-500 to-violet-700 hover:opacity-95 text-white cursor-pointer"
                : "bg-white/[0.05] text-slate-600 cursor-not-allowed"
            }`}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;