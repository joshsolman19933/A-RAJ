import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { wsClient } from '@/lib/ws-client';
import type { WsChatMessage } from '@a-raj/shared';
import { useAuthStore } from './auth.store';

export interface ChatMessage {
  id: string;
  fromUserId: string;
  fromUsername: string;
  message: string;
  sentAt: string;
  channel: 'clan' | 'global' | 'private';
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  receivedAt: string;
}

const MAX_MESSAGES = 200;
const MAX_NOTIFICATIONS = 100;

export const useChatStore = defineStore('chat', () => {
  // --- State ---
  const clanMessages = ref<ChatMessage[]>([]);
  const globalMessages = ref<ChatMessage[]>([]);
  const privateMessages = ref<ChatMessage[]>([]);
  const notifications = ref<Notification[]>([]);
  const activeChannel = ref<'clan' | 'global'>('clan');
  const unreadNotifications = ref(0);
  const unreadClan = ref(0);
  const unreadGlobal = ref(0);
  const isInitialized = ref(false);

  // Cleanup functions for WebSocket listeners
  let unsubClan: (() => void) | null = null;
  let unsubGlobal: (() => void) | null = null;
  let unsubPrivate: (() => void) | null = null;
  let unsubNotification: (() => void) | null = null;

  // --- Computed ---
  const sortedClanMessages = computed(() =>
    [...clanMessages.value].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    ),
  );

  const sortedGlobalMessages = computed(() =>
    [...globalMessages.value].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    ),
  );

  const sortedPrivateMessages = computed(() =>
    [...privateMessages.value].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    ),
  );

  const totalUnread = computed(
    () => unreadNotifications.value + unreadClan.value + unreadGlobal.value,
  );

  // --- Actions ---

  function init(): void {
    if (isInitialized.value) return;
    isInitialized.value = true;

    unsubClan = wsClient.onClanChat((msg) => {
      addMessage({ ...msg, channel: 'clan' });
      if (activeChannel.value !== 'clan') {
        unreadClan.value++;
      }
    });

    unsubGlobal = wsClient.onGlobalChat((msg) => {
      addMessage({ ...msg, channel: 'global' });
      if (activeChannel.value !== 'global') {
        unreadGlobal.value++;
      }
    });

    unsubPrivate = wsClient.onPrivateMessage((msg) => {
      addMessage({ ...msg, channel: 'private' });
    });

    unsubNotification = wsClient.onNotification((data) => {
      addNotification(data);
    });
  }

  function destroy(): void {
    unsubClan?.();
    unsubGlobal?.();
    unsubPrivate?.();
    unsubNotification?.();
    clanMessages.value = [];
    globalMessages.value = [];
    privateMessages.value = [];
    notifications.value = [];
    unreadClan.value = 0;
    unreadGlobal.value = 0;
    unreadNotifications.value = 0;
    isInitialized.value = false;
  }

  function addMessage(msg: ChatMessage): void {
    const target =
      msg.channel === 'clan'
        ? clanMessages
        : msg.channel === 'global'
          ? globalMessages
          : privateMessages;

    target.value.push(msg);

    // Trim to max
    if (target.value.length > MAX_MESSAGES) {
      target.value = target.value.slice(-MAX_MESSAGES);
    }
  }

  function addNotification(data: {
    type: string;
    title: string;
    body: string;
  }): void {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: data.type,
      title: data.title,
      body: data.body,
      receivedAt: new Date().toISOString(),
    };

    notifications.value.unshift(notification);
    unreadNotifications.value++;

    // Trim to max
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS);
    }
  }

  function setActiveChannel(channel: 'clan' | 'global'): void {
    activeChannel.value = channel;
    if (channel === 'clan') {
      unreadClan.value = 0;
    } else {
      unreadGlobal.value = 0;
    }
  }

  function markNotificationsRead(): void {
    unreadNotifications.value = 0;
  }

  function clearNotifications(): void {
    notifications.value = [];
    unreadNotifications.value = 0;
  }

  function sendClanChat(message: string): void {
    if (!message.trim()) return;
    wsClient.emit('clan:chat', { message: message.trim().slice(0, 500) });
  }

  function sendGlobalChat(message: string): void {
    if (!message.trim()) return;
    wsClient.emit('global:chat', { message: message.trim().slice(0, 500) });
  }

  function sendPrivateMessage(toUserId: string, message: string): void {
    if (!toUserId || !message.trim()) return;
    wsClient.emit('private:message', {
      toUserId,
      message: message.trim().slice(0, 500),
    });
  }

  /**
   * Parse chat commands (/w, /c, /g) and return the resolved channel + message.
   * Returns null if no command was detected (use current channel).
   */
  function parseCommand(
    input: string,
  ): {
    channel: 'clan' | 'global' | 'private';
    targetUser?: string;
    message: string;
  } | null {
    const trimmed = input.trim();

    // /w <username> <message>
    const whisperMatch = trimmed.match(/^\/w\s+(\S+)\s+(.+)$/s);
    if (whisperMatch) {
      return {
        channel: 'private',
        targetUser: whisperMatch[1],
        message: whisperMatch[2].trim(),
      };
    }

    // /c <message>
    const clanMatch = trimmed.match(/^\/c\s+(.+)$/s);
    if (clanMatch) {
      return { channel: 'clan', message: clanMatch[1].trim() };
    }

    // /g <message>
    const globalMatch = trimmed.match(/^\/g\s+(.+)$/s);
    if (globalMatch) {
      return { channel: 'global', message: globalMatch[1].trim() };
    }

    return null;
  }

  return {
    // State
    clanMessages,
    globalMessages,
    privateMessages,
    notifications,
    activeChannel,
    unreadNotifications,
    unreadClan,
    unreadGlobal,
    isInitialized,
    // Computed
    sortedClanMessages,
    sortedGlobalMessages,
    sortedPrivateMessages,
    totalUnread,
    // Actions
    init,
    destroy,
    addMessage,
    addNotification,
    setActiveChannel,
    markNotificationsRead,
    clearNotifications,
    sendClanChat,
    sendGlobalChat,
    sendPrivateMessage,
    parseCommand,
  };
});
