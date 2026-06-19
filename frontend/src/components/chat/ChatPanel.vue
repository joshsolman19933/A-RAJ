<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { wsClient } from '@/lib/ws-client';
import type { ChatMessage } from '@/stores/chat.store';

const props = defineProps<{
  channel: 'clan' | 'global' | 'private';
  messages: ChatMessage[];
  placeholder?: string;
  /** Optional target user ID for private messages */
  targetUserId?: string;
}>();

const emit = defineEmits<{
  send: [message: string, targetUserId?: string];
}>();

const chat = useChatStore();
const auth = useAuthStore();

const inputText = ref('');
const messageListRef = ref<HTMLDivElement | null>(null);
const isNearBottom = ref(true);

// Auto-scroll when new messages arrive, if user is near bottom
watch(
  () => props.messages.length,
  () => {
    if (isNearBottom.value) {
      nextTick(scrollToBottom);
    }
  },
);

function onScroll(): void {
  const el = messageListRef.value;
  if (!el) return;
  const threshold = 60;
  isNearBottom.value =
    el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function scrollToBottom(): void {
  const el = messageListRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function handleSend(): void {
  const text = inputText.value.trim();
  if (!text) return;

  // Parse commands
  const cmd = chat.parseCommand(text);
  if (cmd) {
    if (cmd.channel === 'private' && cmd.targetUser) {
      chat.sendPrivateMessage(cmd.targetUser, cmd.message);
    } else if (cmd.channel === 'clan') {
      chat.sendClanChat(cmd.message);
    } else if (cmd.channel === 'global') {
      chat.sendGlobalChat(cmd.message);
    }
  } else {
    // No command, use current channel
    emit('send', text, props.targetUserId);
  }

  inputText.value = '';
  nextTick(scrollToBottom);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isOwn(msg: ChatMessage): boolean {
  return msg.fromUserId === auth.user?.userId;
}

onMounted(() => {
  nextTick(scrollToBottom);
});
</script>

<template>
  <div class="flex flex-col h-full bg-black/40 border border-red-950/30 rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-red-950/30 bg-black/60">
      <span class="text-sm font-medium text-red-400">
        <template v-if="channel === 'clan'">🏰 Klán Chat</template>
        <template v-else-if="channel === 'global'">🌍 Globális Chat</template>
        <template v-else>💬 Privát Üzenet</template>
      </span>
      <span class="text-xs text-zinc-600">{{ messages.length }} üzenet</span>
    </div>

    <!-- Messages -->
    <div
      ref="messageListRef"
      class="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-red-950/50"
      @scroll="onScroll"
    >
      <div
        v-if="messages.length === 0"
        class="flex items-center justify-center h-full text-xs text-zinc-600 italic"
      >
        <template v-if="channel === 'clan'">Még nincs üzenet a klán chat-ben.</template>
        <template v-else-if="channel === 'global'">Még nincs globális üzenet.</template>
        <template v-else>Még nincs privát üzenet.</template>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="flex gap-2 text-sm"
        :class="isOwn(msg) ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] rounded-lg px-3 py-1.5"
          :class="
            isOwn(msg)
              ? 'bg-red-900/40 text-red-100 border border-red-800/40'
              : 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/30'
          "
        >
          <div v-if="!isOwn(msg)" class="text-xs font-medium text-red-400 mb-0.5">
            {{ msg.fromUsername }}
          </div>
          <div class="break-words text-sm">{{ msg.message }}</div>
          <div class="text-[10px] text-zinc-500 mt-1 text-right">
            {{ formatTime(msg.sentAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t border-red-950/30 p-2 bg-black/60">
      <div class="flex gap-2">
        <input
          v-model="inputText"
          type="text"
          :placeholder="placeholder ?? 'Írj üzenetet... (/c, /g, /w név)'"
          maxlength="500"
          class="flex-1 bg-zinc-900 border border-red-950/50 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-700/70 transition-colors"
          @keydown="onKeydown"
        />
        <button
          class="px-3 py-1.5 bg-red-900/60 hover:bg-red-800/60 border border-red-800/40 rounded text-sm text-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!inputText.trim() || !wsClient.isConnected"
          @click="handleSend"
        >
          Küldés
        </button>
      </div>
      <div class="flex gap-3 mt-1.5 text-[10px] text-zinc-600">
        <span><kbd class="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">/c</kbd> klán</span>
        <span><kbd class="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">/g</kbd> globális</span>
        <span><kbd class="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">/w név</kbd> privát</span>
        <span v-if="!wsClient.isConnected" class="ml-auto text-amber-600">⚡ Kapcsolódás...</span>
        <span v-else class="ml-auto">Enter küldés</span>
      </div>
    </div>
  </div>
</template>
