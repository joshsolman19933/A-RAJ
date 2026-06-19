<script setup lang="ts">
import { ref, computed } from 'vue';
import { useChatStore } from '@/stores/chat.store';

const chat = useChatStore();
const isOpen = ref(false);

const hasNotifications = computed(() => chat.notifications.length > 0);
const badgeCount = computed(() => chat.unreadNotifications);

function toggle(): void {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    chat.markNotificationsRead();
  }
}

function close(): void {
  isOpen.value = false;
}

function clearAll(): void {
  chat.clearNotifications();
  isOpen.value = false;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'épp most';
  if (diffMin < 60) return `${diffMin} perce`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} órája`;
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

function notificationIcon(type: string): string {
  switch (type) {
    case 'attack':
      return '⚔️';
    case 'clan':
      return '🏰';
    case 'system':
      return '📢';
    case 'trade':
      return '📦';
    default:
      return '🔔';
  }
}
</script>

<template>
  <div class="relative">
    <!-- Bell button -->
    <button
      class="relative p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
      @click="toggle"
      @blur="close"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      <!-- Badge -->
      <span
        v-if="badgeCount > 0"
        class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-700 rounded-full leading-none"
      >
        {{ badgeCount > 99 ? '99+' : badgeCount }}
      </span>
    </button>

    <!-- Dropdown -->
    <Transition name="notif-fade">
      <div
        v-if="isOpen"
        class="absolute right-0 top-full mt-2 w-80 bg-black/95 border border-red-950/40 rounded-lg shadow-2xl shadow-red-950/30 backdrop-blur-sm z-50 overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-red-950/30 bg-black/70">
          <span class="text-sm font-medium text-red-400">Értesítések</span>
          <button
            v-if="hasNotifications"
            class="text-xs text-zinc-500 hover:text-red-400 transition-colors"
            @mousedown.prevent="clearAll"
          >
            Összes törlése
          </button>
        </div>

        <!-- Notification list -->
        <div class="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-red-950/50">
          <div
            v-if="!hasNotifications"
            class="flex flex-col items-center justify-center py-8 text-zinc-600 text-sm"
          >
            <span class="text-2xl mb-2">🔔</span>
            Nincs új értesítés
          </div>

          <div
            v-for="notif in chat.notifications"
            :key="notif.id"
            class="px-3 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors cursor-default"
          >
            <div class="flex items-start gap-2.5">
              <span class="text-lg flex-shrink-0 mt-0.5">{{ notificationIcon(notif.type) }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-zinc-200 truncate">
                  {{ notif.title }}
                </div>
                <div class="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                  {{ notif.body }}
                </div>
                <div class="text-[10px] text-zinc-600 mt-1">
                  {{ formatTime(notif.receivedAt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
