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
  Menu,
  X,
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
  const [showBilling, setShowBilling] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dispatch = useDispatch();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );
  const { userData } = useSelector((state) => state.user);

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

  // The collapsed rail is desktop-only. Below the lg breakpoint un-collapse,
  // and above it make sure the mobile drawer state is reset.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setCollapsed(false);
      else setMobileOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // While the mobile drawer is open: lock page scroll and allow Esc to close.
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const handleCreateConversation = async () => {
    try {
      const data = await createConversation();
      dispatch(addConversation(data));
      dispatch(setSelectedConversation(data));
      setMobileOpen(false);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleSelectConversation = (conv) => {
    dispatch(setSelectedConversation(conv));
    setMobileOpen(false);
  };

  // ---------- Collapsed rail (desktop only) ----------
  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center w-[56px] h-screen bg-[#0d0f14] border-r border-white/[0.06] py-4 gap-1 shrink-0">
        <button
          className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer mb-1"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <PanelRight />
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
          onClick={handleCreateConversation}
          aria-label="New conversation"
        >
          <Plus size={17} />
        </button>

        <div className="flex-1 w-full overflow-y-auto pb-2 px-2 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {conversations.map((conv) => {
            const isActive = selectedConversation?._id === conv?._id;
            return (
              <div
                key={conv._id}
                onClick={() => handleSelectConversation(conv)}
                title={conv?.title || "New Chat"}
                className={`flex items-center justify-center gap-2.5 cursor-pointer mb-0.5 rounded-[10px] border px-1 py-2 transition-colors duration-150 ${
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

  // ---------- Full sidebar (desktop) / slide-in drawer (mobile) ----------
  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-3 left-3 z-30 flex items-center justify-center w-9 h-9 rounded-lg bg-[#0d0f14] border border-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={14} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        />
      )}

      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[270px] max-w-[85vw] lg:max-w-none h-dvh lg:h-screen shrink-0 bg-[#0d0f14] border-r border-white/[0.06] transition-transform duration-250 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-2.5 py-4 px-4 border-b border-white/[0.06]">
            {/* Desktop collapse button */}
            <button
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftIcon size={18} />
            </button>

            {/* Mobile close button */}
            <button
              className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>

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
          </div>

          {/* New chat button */}
          <div className="px-4 pt-4 pb-1">
            <button
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-linear-to-br from-indigo-500 to-violet-700 rounded-xl py-[10px] border-none cursor-pointer hover:opacity-90 transition-opacity duration-150"
              onClick={handleCreateConversation}
            >
              <Plus size={15} />
              New Chat
            </button>
          </div>

          {/* Section title */}
          <div className="px-5 pt-4 pb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">
            {conversations.length === 0 ? "No Recent Conversations" : "Recents"}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto pb-2 px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {conversations.map((conv) => {
              const isActive = selectedConversation?._id === conv?._id;
              return (
                <div
                  key={conv._id}
                  onClick={() => handleSelectConversation(conv)}
                  title={conv?.title || "New Chat"}
                  className={`flex items-center gap-2.5 cursor-pointer mb-0.5 rounded-[10px] border px-3 py-2.5 transition-colors duration-150 ${
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
                  <span
                    className={`text-[13px] font-medium truncate ${
                      isActive ? "text-slate-100" : "text-slate-300"
                    }`}
                  >
                    {conv?.title || "New Chat"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* User section */}
          <div className="mx-2.5 h-px bg-white/[0.06]" />
          <div className="px-3.5 py-3.5">
            {userData ? (
              <div className="flex items-center gap-2.5 rounded-xl py-2.5 px-3 hover:bg-white/[0.05] transition-colors duration-150">
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

                <span className="flex-1 text-[13px] font-medium text-slate-300 truncate">
                  {userData?.name}
                </span>

                <button
                  onClick={() => setShowBilling(true)}
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
              </div>
            ) : (
              <button className="w-full text-sm text-slate-300 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg py-2 border-none cursor-pointer">
                Login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Outside the sliding div so its fixed positioning isn't affected by the transform */}
      <BillingDrawer open={showBilling} onClose={() => setShowBilling(false)} />
    </>
  );
};

export default SideBar;