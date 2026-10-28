import React, { useEffect, useState } from "react";
import {
  PanelLeftIcon,
  PenSquare,
  Plus,
  MessageSquare,
  User,
  Coins,
  LogOut,
  PanelRight,
} from "lucide-react";
import { getConversations } from "../features/getConversations.js";
import { useDispatch, useSelector } from "react-redux";
import {
  addConversation,
  setConversations,
  setSelectedConversation,
} from "../redux/conversationSlice.js";
import { createConversation } from "../features/createConversation.js";
import logOut from "../features/logOut.js";
import { setUserdata } from "../redux/userSlice.js";
import BillingDrawer from "./BillingDrawer.jsx";

const SideBar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dispatch = useDispatch();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );
  const { userData } = useSelector((state) => state.user)
  const [showBilling, setShowBilling] = useState(false)

  // Load conversations once
  useEffect(() => {
    const getConv = async () => {
      try {
        const data = await getConversations();
        dispatch(setConversations(data));
      } catch (err) {
        console.error("Failed to load conversations:", err);
      }
    };
    getConv();
  }, [dispatch]);

  // Reset image error when the avatar URL changes
  useEffect(() => {
    setImageError(false);
  }, [userData?.avatar]);

  const handleCreateConversation = async () => {
    try {
      const data = await createConversation();
      dispatch(addConversation(data));
      dispatch(setSelectedConversation(data));
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center w-[56px] h-screen bg-[#0d0f14] border-r border-white/[0.06] py-4 gap-1 shrink-0">
        <button
          className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer mb-1"
          onClick={() => setCollapsed(false)}
        >
          <PanelRight />
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
          onClick={handleCreateConversation}
        >
          <Plus size={17} />
        </button>
        <div
          className={`flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            collapsed ? "px-2 pt-3" : "px-2.5"
          }`}
        >
          {conversations.map((conv) => {
            const isActive = selectedConversation?._id === conv?._id;
            return (
              <div
                key={conv._id}
                onClick={() => dispatch(setSelectedConversation(conv))}
                title={conv?.title || "New Chat"}
                className={`flex items-center gap-2.5 cursor-pointer mb-0.5 rounded-[10px] border transition-colors duration-150 ${
                  collapsed ? "justify-center px-1 py-2" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-indigo-500/10 border-indigo-500/[0.18]"
                    : "bg-transparent border-transparent"
                }`}
              >
                <div
                  className={`flex items-center justify-center shrink-0 w-[20px] h-[20px] rounded-lg transition-colors duration-150 ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-400"
                      : "bg-white/[0.05] text-slate-500"
                  }`}
                >
                  <MessageSquare size={13} />
                </div>
                
              </div>
            );
          })}
        </div>

              <div className="relative shrink-0">
                {userData?.avatar && !imageError ? (
                  <img
                    className="w-9 h-9 rounded-[10px] object-cover border-2 border-indigo-500/25"
                    src={userData.avatar}
                    alt="profile"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-[10px] bg-white/[0.06] flex items-center justify-center">
                    <User size={15} className="text-slate-400" />
                  </div>
                )}
              </div>

      </div>
    );
  }

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 z-50 ${
        collapsed ? "w-[64px]" : "w-[270px]"
      } h-screen shrink-0 bg-[#0d0f14] border-r border-white/[0.06] transition-all duration-200 overflow-hidden`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className={`flex items-center gap-2.5 py-4 border-b border-white/[0.06] ${
            collapsed ? "px-3 justify-center" : "px-4"
          }`}
        >
          <button
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label="Toggle sidebar"
          >
            <PanelLeftIcon size={18} />
          </button>

          {!collapsed && (
            <>
              <span className="text-[16px] font-semibold text-slate-100 tracking-tight flex-1">
                CortexAI
              </span>
              <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full tracking-wide">
                free
              </span>
              <button
                className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
                onClick={handleCreateConversation}
                aria-label="New conversation"
              >
                <PenSquare size={14} />
              </button>
            </>
          )}
        </div>

        {/* New chat button */}
        <div className={collapsed ? "px-3 pt-4 pb-1" : "px-4 pt-4 pb-1"}>
          <button
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-linear-to-br from-indigo-500 to-violet-700 rounded-xl py-[10px] border-none cursor-pointer hover:opacity-90 transition-opacity duration-150"
            onClick={handleCreateConversation}
          >
            <Plus size={15} />
            {!collapsed && "New Chat"}
          </button>
        </div>

        {/* Section title */}
        {!collapsed && (
          <div className="px-5 pt-4 pb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">
            {conversations.length === 0 ? "No Recent Conversations" : "Recents"}
          </div>
        )}

        {/* Conversation list */}
        <div
          className={`flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            collapsed ? "px-2 pt-3" : "px-2.5"
          }`}
        >
          {conversations.map((conv) => {
            const isActive = selectedConversation?._id === conv?._id;
            return (
              <div
                key={conv._id}
                onClick={() => dispatch(setSelectedConversation(conv))}
                title={conv?.title || "New Chat"}
                className={`flex items-center gap-2.5 cursor-pointer mb-0.5 rounded-[10px] border transition-colors duration-150 ${
                  collapsed ? "justify-center px-1 py-2" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-indigo-500/10 border-indigo-500/[0.18]"
                    : "bg-transparent border-transparent"
                }`}
              >
                <div
                  className={`flex items-center justify-center shrink-0 w-[28px] h-[28px] rounded-lg transition-colors duration-150 ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-400"
                      : "bg-white/[0.05] text-slate-500"
                  }`}
                >
                  <MessageSquare size={13} />
                </div>
                {!collapsed && (
                  <span
                    className={`text-[13px] font-medium truncate ${
                      isActive ? "text-slate-100" : "text-slate-300"
                    }`}
                  >
                    {conv?.title || "New Chat"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* User section */}
        <div className="mx-2.5 h-px bg-white/[0.06]" />
        <div className={collapsed ? "px-2 py-3.5" : "px-3.5 py-3.5"}>
          {userData ? (
            <div
              className={`flex items-center gap-2.5 rounded-xl py-2.5 hover:bg-white/[0.05] transition-colors duration-150 ${
                collapsed ? "justify-center px-1" : "px-3"
              }`}
            >
              <div className="relative shrink-0">
                {userData?.avatar && !imageError ? (
                  <img
                    className="w-9 h-9 rounded-[10px] object-cover border-2 border-indigo-500/25"
                    src={userData.avatar}
                    alt="profile"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-[10px] bg-white/[0.06] flex items-center justify-center">
                    <User size={15} className="text-slate-400" />
                  </div>
                )}
              </div>

              {!collapsed && (
                <>
                  <span className="flex-1 text-[13px] font-medium text-slate-300 truncate">
                    {userData?.name}
                  </span>

                  <button
                  onClick={()=>setShowBilling(true)}
                    className="flex items-center justify-center w-7 h-7 rounded-[7px] border-none bg-transparent text-yellow-600 cursor-pointer hover:bg-white/[0.08] hover:text-yellow-500 transition-all duration-150"
                    aria-label="Credits"
                  >
                    <Coins size={16} />
                  </button>
                  <button
                    className="flex items-center justify-center w-7 h-7 rounded-[7px] border-none bg-transparent text-red-500 cursor-pointer hover:bg-white/[0.08] hover:text-red-400 transition-all duration-150"
                    aria-label="Log out"
                    onClick={() => {
                      logOut();
                      dispatch(setUserdata(null));
                    }}
                  >
                    <LogOut size={16} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button className="w-full text-sm text-slate-300 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg py-2 border-none cursor-pointer">
              {collapsed ? <User size={15} className="mx-auto" /> : "Login"}
            </button>
          )}
        </div>
      </div>

      <BillingDrawer
      open={showBilling}
      onClose={()=>setShowBilling(false)}
      />

    </div>
  );
};

export default SideBar;
