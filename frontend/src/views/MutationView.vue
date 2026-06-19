<script setup lang="ts">
import { onMounted } from 'vue';
import { useMutationStore } from '@/stores/mutation.store';
import { useHiveStore } from '@/stores/hive.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';
import MutationTree from '@/components/mutation/MutationTree.vue';

const mutationStore = useMutationStore();
const hiveStore = useHiveStore();
const auth = useAuthStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}

onMounted(async () => {
  if (!hiveStore.hasHive) {
    await hiveStore.fetchHive();
  }
  await mutationStore.fetchTree();
});
</script>

<template>
  <div class="p-4 max-w-2xl mx-auto pb-20 md:pb-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-2xl font-bold text-red-500">Mutációs Háló</h1>
        <p class="text-xs text-zinc-600 mt-0.5">
          {{ mutationStore.researchedMutations.length }} kutatott mutáció
        </p>
      </div>
    </div>

    <!-- DNA Nectar display -->
    <div class="mb-4 p-3 rounded-lg border border-amber-900/40 bg-black/40 flex items-center gap-3">
      <span class="text-lg">🧬</span>
      <div>
        <div class="text-xs text-zinc-500">DNS Nektár</div>
        <div class="text-sm font-semibold text-amber-400">
          {{ Math.floor(hiveStore.resources.dnaNectar) }}
        </div>
      </div>
    </div>

    <!-- Mutation tree -->
    <MutationTree />
  </div>
</template>
