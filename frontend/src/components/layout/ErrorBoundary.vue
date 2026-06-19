<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const error = ref<Error | null>(null);
const showDetails = ref(false);

onErrorCaptured((err: Error, instance, info) => {
  error.value = err;
  console.error('[ErrorBoundary]', err.message, info);
  return false; // Prevent propagation
});

function retry() {
  error.value = null;
}
</script>

<template>
  <div v-if="error" class="flex items-center justify-center min-h-[60vh] px-4">
    <div class="max-w-md w-full p-6 rounded-xl border border-red-900/50 bg-black/80 backdrop-blur-sm text-center">
      <!-- Icon -->
      <div class="text-4xl mb-4 text-red-700" aria-hidden="true">&#9760;</div>

      <!-- Title -->
      <h2 class="text-lg font-semibold text-red-400 mb-2">
        Hiba történt
      </h2>

      <!-- Message -->
      <p class="text-sm text-zinc-400 mb-4">
        Váratlan hiba történt a komponens betöltése közben.
      </p>

      <!-- Error details toggle -->
      <button
        class="mb-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2"
        :aria-expanded="showDetails"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? 'Részletek elrejtése' : 'Részletek mutatása' }}
      </button>

      <pre
        v-if="showDetails"
        class="mb-4 p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-left text-zinc-400 overflow-x-auto max-h-32"
      >{{ error.message }}
{{ error.stack }}</pre>

      <!-- Retry -->
      <button
        class="px-6 py-2.5 bg-red-900/50 hover:bg-red-800 border border-red-700/30 text-red-300 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-red-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
        aria-label="Újrapróbálkozás"
        @click="retry"
      >
        &#8635; Újrapróbálkozás
      </button>
    </div>
  </div>

  <!-- Normal content -->
  <slot v-else />
</template>
