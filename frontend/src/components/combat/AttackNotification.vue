<script setup lang="ts">
import { computed } from 'vue';
import { useMovementStore } from '@/stores/movement.store';

const store = useMovementStore();

const flashClass = computed(() => {
  if (store.screenFlash === 'victory') return 'flash-victory';
  if (store.screenFlash === 'defeat') return 'flash-defeat';
  return '';
});
</script>

<template>
  <Transition name="flash">
    <div
      v-if="store.screenFlash"
      class="fixed inset-0 z-40 pointer-events-none"
      :class="flashClass"
    />
  </Transition>
</template>

<style scoped>
.flash-victory {
  animation: flashVictory 1.5s ease-out forwards;
}

.flash-defeat {
  animation: flashDefeat 1.5s ease-out forwards;
}

@keyframes flashVictory {
  0% {
    box-shadow: inset 0 0 120px rgba(245, 158, 11, 0.6);
    border: 4px solid rgba(245, 158, 11, 0.8);
  }
  30% {
    box-shadow: inset 0 0 80px rgba(245, 158, 11, 0.3);
    border: 4px solid rgba(245, 158, 11, 0.4);
  }
  100% {
    box-shadow: inset 0 0 0 rgba(245, 158, 11, 0);
    border: 4px solid rgba(245, 158, 11, 0);
  }
}

@keyframes flashDefeat {
  0% {
    box-shadow: inset 0 0 120px rgba(239, 68, 68, 0.7);
    border: 4px solid rgba(239, 68, 68, 0.9);
    animation-timing-function: ease-out;
  }
  10% {
    box-shadow: inset 0 0 80px rgba(239, 68, 68, 0.2);
    border: 4px solid rgba(239, 68, 68, 0.3);
  }
  20% {
    box-shadow: inset 0 0 120px rgba(239, 68, 68, 0.7);
    border: 4px solid rgba(239, 68, 68, 0.9);
  }
  40% {
    box-shadow: inset 0 0 60px rgba(239, 68, 68, 0.3);
    border: 4px solid rgba(239, 68, 68, 0.4);
  }
  100% {
    box-shadow: inset 0 0 0 rgba(239, 68, 68, 0);
    border: 4px solid rgba(239, 68, 68, 0);
  }
}

.flash-enter-active {
  transition: opacity 0.1s;
}
.flash-leave-active {
  transition: opacity 0.5s;
}
.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}
</style>
