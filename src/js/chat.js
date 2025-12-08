// src/js/chat.js
import { sb } from "./supabase.js";
import {
  getCurrentUserId,
  checkForUnreadMessages,
  subscribeToNotifications,
} from "./auth.js";

// --- DOM Elements ---
const roomList = document.getElementById("room-list");
const chatHeader = document.getElementById("chat-header");
const chatMessages = document.getElementById("chat-messages");
const chatInputForm = document.getElementById("chat-input-form");
const messageInput = document.getElementById("message-input");

// --- Global State ---
let activeChatRoomId = null;
let lastMessageDate = null;

// --- Functions ---

export async function handleStartChat(farmerId, currentUserId) {
  const { data: existingRoom } = await sb
    .from("chat_rooms")
    .select("id")
    .eq("buyer_id", currentUserId)
    .eq("farmer_id", farmerId)
    .single();

  if (existingRoom) {
    window.location.href = `/messages.html?room_id=${existingRoom.id}`;
  } else {
    const { data: newRoom, error } = await sb
      .from("chat_rooms")
      .insert({ buyer_id: currentUserId, farmer_id: farmerId })
      .select("id")
      .single();

    if (error) alert("Error starting chat.");
    else window.location.href = `/messages.html?room_id=${newRoom.id}`;
  }
}

export function initChatPage() {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    setTimeout(initChatPage, 200);
    return;
  }

  subscribeToNotifications(null, null);

  if (chatInputForm) {
    const btn = chatInputForm.querySelector("button");
    if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';

    chatInputForm.addEventListener("submit", (e) =>
      handleSendMessage(e, currentUserId)
    );
  }
  loadChatPage(currentUserId);
}

async function loadChatPage(currentUserId) {
  if (!roomList) return;
  const unreadCounts = await checkForUnreadMessages();

  const { data: rooms, error } = await sb
    .from("chat_rooms")
    .select(
      `id, buyer_id, farmer_id, buyer:buyer_id ( full_name ), farmer:farmer_id ( full_name )`
    )
    .or(`buyer_id.eq.${currentUserId},farmer_id.eq.${currentUserId}`);

  if (error) {
    roomList.innerHTML =
      "<p style='padding:1rem'>Error loading conversations.</p>";
    return;
  }
  if (rooms.length === 0) {
    roomList.innerHTML = "<p style='padding:1rem'>No conversations yet.</p>";
    if (chatHeader) chatHeader.textContent = "";
    if (chatMessages)
      chatMessages.innerHTML = `
      <div class="chat-empty-state">
        <i class="fa-solid fa-comments"></i>
        <p>No messages selected</p>
        <span>Select a conversation to start chatting.</span>
      </div>
    `;
    if (chatInputForm) chatInputForm.style.display = "none";
    return;
  }

  if (chatInputForm) chatInputForm.style.display = "flex";

  roomList.innerHTML = "";
  rooms.forEach((room) => {
    const otherPersonName =
      currentUserId === room.buyer_id
        ? room.farmer.full_name
        : room.buyer.full_name;

    const roomEl = document.createElement("div");
    roomEl.className = "room-item";
    roomEl.appendChild(document.createTextNode(otherPersonName));

    roomEl.dataset.roomId = room.id;
    roomEl.dataset.roomName = otherPersonName;

    if (unreadCounts && unreadCounts[room.id]) {
      const bubble = document.createElement("span");
      bubble.className = "room-notification-bubble";
      bubble.textContent = unreadCounts[room.id];
      roomEl.appendChild(bubble);
    }
    roomEl.addEventListener("click", () => {
      document.querySelector(".chat-container").classList.add("chat-active");
      loadChatRoom(room.id, otherPersonName, currentUserId);
    });
    roomList.appendChild(roomEl);
  });

  const params = new URLSearchParams(window.location.search);
  const urlRoomId = params.get("room_id");
  if (urlRoomId) {
    const roomToLoad = document.querySelector(
      `.room-item[data-room-id="${urlRoomId}"]`
    );
    if (roomToLoad) roomToLoad.click();
  }
}

async function loadChatRoom(roomId, roomName, currentUserId) {
  activeChatRoomId = roomId;
  lastMessageDate = null;

  const newUrl = `/messages.html?room_id=${roomId}`;
  window.history.pushState({ path: newUrl }, "", newUrl);

  const roomEl = document.querySelector(`.room-item[data-room-id="${roomId}"]`);
  if (roomEl) {
    roomEl.classList.add("active-room");
    const bubble = roomEl.querySelector(".room-notification-bubble");
    if (bubble) bubble.style.display = "none";
  }

  document.querySelectorAll(".room-item").forEach((el) => {
    if (el !== roomEl) el.classList.remove("active-room");
  });

  // ★ SECURITY FIX: Using DOM API instead of innerHTML
  chatHeader.innerHTML = ""; // Clear existing

  const backBtn = document.createElement("button");
  backBtn.id = "chat-back-btn";
  backBtn.className = "chat-back-btn";
  backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
  backBtn.addEventListener("click", () => {
    document.querySelector(".chat-container").classList.remove("chat-active");
    activeChatRoomId = null;
    subscribeToNotifications(null, null);
    window.history.pushState({ path: "/messages.html" }, "", "/messages.html");
  });

  const titleP = document.createElement("p");
  titleP.textContent = roomName; // Safe text insertion

  chatHeader.appendChild(backBtn);
  chatHeader.appendChild(titleP);

  chatMessages.innerHTML =
    "<p style='padding:2rem; text-align:center;'>Loading messages...</p>";

  await sb
    .from("chat_messages")
    .update({ is_read: true })
    .eq("room_id", roomId)
    .neq("sender_id", currentUserId);
  await checkForUnreadMessages();

  const { data: messages, error } = await sb
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at");

  if (error) {
    chatMessages.innerHTML = "<p>Error loading messages.</p>";
    return;
  }

  chatMessages.innerHTML = "";
  messages.forEach((msg) => {
    addMessageToUI(msg, currentUserId);
  });
  scrollToBottom();

  subscribeToNotifications((msg) => {
    if (msg.room_id === activeChatRoomId) {
      const existing = document.getElementById(`msg-${msg.id}`);
      if (!existing) {
        addMessageToUI(msg, currentUserId);
        scrollToBottom();
        markMessageAsRead(msg.id, currentUserId);
      }
    }
  }, roomId);
}

function addMessageToUI(msg, currentUserId) {
  const dateHeader = formatDateHeader(msg.created_at);
  if (dateHeader) {
    const headerEl = document.createElement("div");
    headerEl.className = "date-header";
    headerEl.textContent = dateHeader;
    chatMessages.appendChild(headerEl);
  }

  const bubble = document.createElement("div");
  bubble.id = `msg-${msg.id}`;
  bubble.className = "message-bubble";
  bubble.classList.add(msg.sender_id === currentUserId ? "sender" : "receiver");

  const content = document.createElement("span");
  content.textContent = msg.message_content;

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = formatMessageTime(msg.created_at);

  bubble.appendChild(content);
  bubble.appendChild(time);
  chatMessages.appendChild(bubble);
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function markMessageAsRead(messageId, currentUserId) {
  await sb
    .from("chat_messages")
    .update({ is_read: true })
    .eq("id", messageId)
    .neq("sender_id", currentUserId);
}

async function handleSendMessage(e, currentUserId) {
  e.preventDefault();
  if (!activeChatRoomId) return;
  const messageText = messageInput.value.trim();
  if (messageText.length === 0) return;

  messageInput.disabled = true;

  const tempId = `temp-${Date.now()}`;

  const optimisticMsg = {
    id: tempId,
    room_id: activeChatRoomId,
    sender_id: currentUserId,
    message_content: messageText,
    created_at: new Date().toISOString(),
  };

  addMessageToUI(optimisticMsg, currentUserId);
  scrollToBottom();

  messageInput.value = "";

  const { data, error } = await sb
    .from("chat_messages")
    .insert({
      room_id: activeChatRoomId,
      sender_id: currentUserId,
      message_content: messageText,
    })
    .select()
    .single();

  if (error) {
    console.error("Error sending:", error.message);
  } else {
    const bubble = document.getElementById(`msg-${tempId}`);
    if (bubble) {
      bubble.id = `msg-${data.id}`;
    }
  }

  messageInput.disabled = false;
  messageInput.focus();
}

function formatMessageTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateHeader(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toLocaleDateString();
  if (lastMessageDate === dateStr) {
    return null;
  }
  lastMessageDate = dateStr;

  if (dateStr === today.toLocaleDateString()) return "Today";
  if (dateStr === yesterday.toLocaleDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
