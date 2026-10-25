import React, { useEffect } from "react";
import Nav from "./Nav";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import getMessages from "../features/getMessages.js";
import { useDispatch, useSelector, useStore } from "react-redux";
import { setMessages, setArtifacts } from "../redux/messageSlice.js";   // CHANGED: added setArtifacts

const ChatArea = () => {
  const { selectedConversation } = useSelector((state) => state.conversation);
  const dispatch = useDispatch();
  const store = useStore();
  const conversationId = selectedConversation?._id;

  useEffect(() => {
    // No chat selected: clear old messages and artifacts
    if (!conversationId) {
      dispatch(setMessages([]));
      dispatch(setArtifacts([]));                       // CHANGED
      return;
    }

    // A chat that was just created by sending a message already has its
    // messages in the store: do not reload (and wipe) them
    const current = store.getState().message.messages;
    if (current.length > 0 && current[0]?.conversationId === conversationId) {
      return;
    }

    // Ignore the response if the user switched to another chat meanwhile
    let ignore = false;

    const loadMessages = async () => {
      const data = await getMessages(conversationId);
      if (ignore) return;

      const messages = Array.isArray(data) ? data : [];
      dispatch(setMessages(messages));

      // CHANGED: load the artifacts of this chat
      const artifacts = Array.isArray(data)
        ? data.flatMap((m) => m.artifacts || [])   // artifacts stored on each message
        : data?.artifacts || [];                   // artifacts returned next to messages
      dispatch(setArtifacts(artifacts));
    };

    loadMessages();

    return () => {
      ignore = true;
    };
  }, [conversationId, dispatch, store]);

  return (
    <div className="flex-1 min-w-0 h-screen flex flex-col">
      <Nav />
      <MessageList />
      <ChatInput />
    </div>
  );
};

export default ChatArea;