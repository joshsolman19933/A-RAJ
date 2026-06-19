import { onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { wsClient } from '@/lib/ws-client';

/**
 * Vue composable that manages the WebSocket connection lifecycle.
 * Automatically connects when the user logs in and disconnects on logout.
 *
 * Usage in App.vue or a root-level component:
 *   useWebSocket();
 *
 * No return value needed — it's a side-effect composable.
 */
export function useWebSocket(): void {
  const auth = useAuthStore();

  // Connect when token becomes available
  watch(
    () => auth.token,
    (newToken, oldToken) => {
      if (newToken) {
        wsClient.connect(newToken);
      } else if (oldToken && !newToken) {
        wsClient.disconnect();
      }
    },
    { immediate: true },
  );

  // Cleanup on component unmount (though composable is typically used at root)
  onUnmounted(() => {
    // Don't disconnect — the connection should persist across route changes
    // Only disconnect on explicit logout
  });
}
