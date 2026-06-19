<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useRouter } from 'vue-router';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import NotificationPanel from '@/components/chat/NotificationPanel.vue';

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}

// Init chat store WebSocket listeners
onMounted(() => {
  chat.init();
});

onUnmounted(() => {
  // Don't destroy — chat persists across route changes
});

// Private message state
const privateRecipient = ref('');
const privateRecipientUserId = ref('');
const showPrivate = ref(false);

function onSendClan(message: string): void {
  chat.sendClanChat(message);
}

function onSendGlobal(message: string): void {
  chat.sendGlobalChat(message);
}

function onSendPrivate(message: string, targetUserId?: string): void {
  if (targetUserId) {
    chat.sendPrivateMessage(targetUserId, message);
  }
}

function openPrivateChat(): void {
  const recipient = privateRecipient.value.trim();
  if (!recipient) return;
  // For now, use username as userId — in a real implementation,
  // we'd need a user lookup endpoint. This works for demo purposes
  // since the gateway stores socketUsers by actual userId.
  privateRecipientUserId.value = recipient;
  showPrivate.value = true;
}

function closePrivateChat(): void {
  showPrivate.value = false;
  privateRecipient.value = '';
  privateRecipientUserId.value = '';
}
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-3rem)] bg-zinc-950 text-zinc-200">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-2 border-b border-red-950/30 bg-black/60">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-bold text-red-400 tracking-wide">💬 Kommunikáció</h1>
      </div>
      <NotificationPanel />
    </header>

    <!-- Main content: Tabs + Private sidebar -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Chat area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Tabs -->
        <div class="flex border-b border-red-950/30 bg-black/50">
          <button
            class="relative px-4 py-2 text-sm font-medium transition-colors"
            :class="
              chat.activeChannel === 'clan'
                ? 'text-red-400 border-b-2 border-red-600'
                : 'text-zinc-500 hover:text-zinc-300'
            "
            @click="chat.setActiveChannel('clan')"
          >
            🏰 Klán
            <span
              v-if="chat.unreadClan > 0 && chat.activeChannel !== 'clan'"
              class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-700 rounded-full leading-none"
            >
              {{ chat.unreadClan > 99 ? '99+' : chat.unreadClan }}
            </span>
          </button>
          <button
            class="relative px-4 py-2 text-sm font-medium transition-colors"
            :class="
              chat.activeChannel === 'global'
                ? 'text-red-400 border-b-2 border-red-600'
                : 'text-zinc-500 hover:text-zinc-300'
            "
            @click="chat.setActiveChannel('global')"
          >
            🌍 Globális
            <span
              v-if="chat.unreadGlobal > 0 && chat.activeChannel !== 'global'"
              class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-700 rounded-full leading-none"
            >
              {{ chat.unreadGlobal > 99 ? '99+' : chat.unreadGlobal }}
            </span>
          </button>

          <div class="flex-1" />

          <!-- Private chat opener -->
          <button
            class="px-3 py-2 text-sm text-zinc-500 hover:text-red-400 transition-colors"
            @click="showPrivate = !showPrivate"
          >
            💬 Privát
          </button>
        </div>

        <!-- Chat panels -->
        <div class="flex-1 p-3 min-h-0">
          <ChatPanel
            v-if="chat.activeChannel === 'clan'"
            channel="clan"
            :messages="chat.sortedClanMessages"
            placeholder="Üzenet a klánnak... (/c automatikus)"
            @send="onSendClan"
          />
          <ChatPanel
            v-else
            channel="global"
            :messages="chat.sortedGlobalMessages"
            placeholder="Üzenet mindenkinek... (/g automatikus)"
            @send="onSendGlobal"
          />
        </div>
      </div>

      <!-- Private chat sidebar -->
      <Transition name="slide">
        <aside
          v-if="showPrivate"
          class="w-80 border-l border-red-950/30 bg-black/50 flex flex-col"
        >
          <div class="flex items-center justify-between px-3 py-2 border-b border-red-950/30">
            <div class="flex items-center gap-2">
              <span class="text-xs text-zinc-500">Címzett:</span>
              <input
                v-model="privateRecipient"
                type="text"
                placeholder="Felhasználónév..."
                class="w-32 bg-zinc-900 border border-red-950/50 rounded px-2 py-0.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-700/70"
                @keydown.enter="openPrivateChat"
              />
            </div>
            <button
              class="text-zinc-600 hover:text-red-400 text-sm transition-colors"
              @click="closePrivateChat"
            >
              ✕
            </button>
          </div>
          <div class="flex-1 p-2 min-h-0">
            <ChatPanel
              v-if="privateRecipientUserId"
              channel="private"
              :messages="chat.sortedPrivateMessages.filter(
                (m) =>
                  m.fromUserId === privateRecipientUserId ||
                  m.fromUserId === auth.userId
              )"
              :target-user-id="privateRecipientUserId"
              :placeholder="`Üzenet neki: ${privateRecipient}... (/w ${privateRecipient})`"
              @send="onSendPrivate"
            />
            <div
              v-else
              class="flex flex-col items-center justify-center h-full text-xs text-zinc-600"
            >
              <span class="text-2xl mb-2">💬</span>
              Adj meg egy felhasználónevet<br />a privát chat indításához
            </div>
          </div>
        </aside>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: width 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  width: 0 !important;
}
</style>
