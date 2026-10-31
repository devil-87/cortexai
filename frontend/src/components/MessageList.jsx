import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import MessageBubble from "./MessageBubble";
import Loading from "./Loading.jsx"; // ADDED

const suggestions = ["Write a Netflix clone", "Explain Redis", "Build a dashboard"];

const MessageList = () => {
  const { messages } = useSelector((state) => state.message);
  const bottomRef = useRef(null);

  const isEmpty = !messages || messages.length === 0;

  // ADDED: the user just sent a message and the AI has not answered yet.
  // Only freshly sent messages (temp ids) count, so an old chat whose last
  // message is from the user never shows the loader forever.
  const lastMessage = messages?.[messages.length - 1];
  const isWaiting =
    lastMessage?.role === "user" && lastMessage?._id?.startsWith("temp-user");

  // Scroll to the newest message, or to the loader, whenever either appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length, isWaiting]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4 sm:py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {isEmpty ? (
        <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-2">
          <div className="flex flex-col gap-1.5 items-center">
            <h1 className="text-[18px] sm:text-[20px] font-semibold text-slate-200 tracking-tight">
              CortexAI
            </h1>
            <p className="text-[14px] sm:text-[15px] font-semibold text-slate-400 tracking-tight">
              How can I help you?
            </p>
            <p className="text-[12.5px] sm:text-[13px] text-slate-600 max-w-[280px] sm:max-w-sm leading-relaxed">
              Ask me anything - code, ideas, explanations, or just a quick
              question.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-1 max-w-md">
            {suggestions.map((s) => (
              <button
                key={s}
                className="text-[12px] text-slate-400 bg-white/[0.04] border border-white/[0.07] px-3 py-1.5 rounded-lg hover:bg-white/[0.08] hover:text-slate-200 transition-colors duration-150 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-5 w-full max-w-3xl mx-auto min-w-0">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg?._id || i}
              role={msg?.role}
              content={msg?.content}
              images={msg?.images}
            />
          ))}

          {/* ADDED: three bouncing dots + topic words until the reply arrives */}
          {isWaiting && (
            <Loading agent={lastMessage.agent} prompt={lastMessage.content} />
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default MessageList;