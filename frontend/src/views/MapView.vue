<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useMapStore } from '@/stores/map.store';
import { useHiveStore } from '@/stores/hive.store';
import { useMilitaryStore } from '@/stores/military.store';
import { useMovementStore } from '@/stores/movement.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';
import { HexType, HEX_SIZE_PX, PheromoneType } from '@a-raj/shared';
import type { MapHexData, HexCoord, PheromoneTrailData } from '@a-raj/shared';
import { axialToPixel, pixelToAxial } from '@a-raj/shared';
import { wsClient } from '@/lib/ws-client';
import { api } from '@/services/auth.service';
import AttackPanel from '@/components/combat/AttackPanel.vue';
import CombatReport from '@/components/combat/CombatReport.vue';
import AttackNotification from '@/components/combat/AttackNotification.vue';

const mapStore = useMapStore();
const hiveStore = useHiveStore();
const militaryStore = useMilitaryStore();
const movementStore = useMovementStore();
const auth = useAuthStore();
const router = useRouter();

if (!auth.isLoggedIn) {
  router.push('/login');
}

// Canvas ref
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Camera state
const camera = ref({ x: 0, y: 0, zoom: 1 });
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, camX: 0, camY: 0 });

// Hex size (scaled by zoom)
const hexSize = computed(() => HEX_SIZE_PX * camera.value.zoom);

// Viewport in hex coordinates
const viewRadius = computed(() => {
  const w = window.innerWidth / hexSize.value / 1.5;
  const h = window.innerHeight / hexSize.value / 1.1;
  return Math.ceil(Math.max(w, h)) + 2;
});

// Center hex coordinate
const centerHex = computed(() => {
  const cx = -camera.value.x / hexSize.value;
  const cy = -camera.value.y / hexSize.value;
  return pixelToAxial(cx, cy, 1);
});

// --- Pheromone drawing state ---
const drawMode = ref(false);
const drawType = ref<PheromoneType>(PheromoneType.ATTACK);
const isDrawingPath = ref(false);
const drawPoints = ref<HexCoord[]>([]);
const activeTrails = ref<PheromoneTrailData[]>([]);
const liveDrawings = ref<Array<{ userId: string; partialPath: HexCoord[]; type: PheromoneType }>>([]);
const pheromoneError = ref<string | null>(null);

// WebSocket cleanup
let pheromoneCleanup: (() => void) | null = null;

onMounted(async () => {
  // Fetch hive data to center map on player's hive
  if (!hiveStore.hasHive) {
    await hiveStore.fetchHive();
  }
  await loadViewport();
  window.addEventListener('resize', onResize);
  onResize();

  // Listen for pheromone visible events from clan members
  pheromoneCleanup = wsClient.on(
    'pheromone:visible' as never,
    (data: { userId: string; partialPath: HexCoord[]; type: PheromoneType }) => {
      const idx = liveDrawings.value.findIndex((d) => d.userId === data.userId);
      if (idx >= 0) {
        liveDrawings.value[idx] = { ...data };
      } else {
        liveDrawings.value.push({ ...data });
      }
      // Auto-remove stale live drawings after 4s
      setTimeout(() => {
        liveDrawings.value = liveDrawings.value.filter((d) => d.userId !== data.userId);
      }, 4000);
    },
  );

  renderLoop();
});

onUnmounted(() => {
  cancelAnimationFrame(animFrame);
  window.removeEventListener('resize', onResize);
  if (reloadTimeout) clearTimeout(reloadTimeout);
  pheromoneCleanup?.();
});

function onResize() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  loadViewport();
}

async function loadViewport() {
  const r = viewRadius.value;
  const ch = centerHex.value;
  await mapStore.fetchViewport(ch.q - r, ch.q + r, ch.r - r, ch.r + r);
}

// Debounced viewport reload
let lastCenter = { q: 0, r: 0 };
let reloadTimeout: ReturnType<typeof setTimeout> | null = null;

function maybeReloadViewport() {
  const ch = centerHex.value;
  if (Math.abs(ch.q - lastCenter.q) < 5 && Math.abs(ch.r - lastCenter.r) < 5) return;
  lastCenter = { q: ch.q, r: ch.r };
  if (reloadTimeout) clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(loadViewport, 200);
}

// --- Mouse / Touch handlers ---

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;

  if (drawMode.value) {
    // Draw mode: start drawing path
    isDrawingPath.value = true;
    const hex = eventToHex(e);
    if (hex) drawPoints.value = [{ ...hex }];
    return;
  }

  // Pan mode
  isPanning.value = true;
  panStart.value = { x: e.clientX, y: e.clientY, camX: camera.value.x, camY: camera.value.y };
}

function onMouseMove(e: MouseEvent) {
  if (drawMode.value && isDrawingPath.value) {
    const hex = eventToHex(e);
    if (hex && drawPoints.value.length < 50) {
      const last = drawPoints.value[drawPoints.value.length - 1];
      if (!last || last.q !== hex.q || last.r !== hex.r) {
        drawPoints.value = [...drawPoints.value, hex];
        // Emit live drawing via WebSocket
        wsClient.emit('pheromone:draw', { partialPath: drawPoints.value, type: drawType.value });
      }
    }
    return;
  }

  if (!isPanning.value) return;
  const dx = e.clientX - panStart.value.x;
  const dy = e.clientY - panStart.value.y;
  camera.value.x = panStart.value.camX + dx;
  camera.value.y = panStart.value.camY + dy;
  maybeReloadViewport();
}

function onMouseUp(e: MouseEvent) {
  if (drawMode.value && isDrawingPath.value) {
    isDrawingPath.value = false;
    // Save the trail via REST API
    if (drawPoints.value.length >= 2) {
      saveTrail();
    }
    return;
  }

  if (!isPanning.value) return;
  const dx = Math.abs(e.clientX - panStart.value.x);
  const dy = Math.abs(e.clientY - panStart.value.y);
  isPanning.value = false;

  if (dx < 5 && dy < 5) {
    handleClick(e);
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  camera.value.zoom = Math.max(0.3, Math.min(3, camera.value.zoom * factor));
  maybeReloadViewport();
}

function eventToHex(e: MouseEvent): HexCoord | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left - camera.value.x) / hexSize.value;
  const py = (e.clientY - rect.top - camera.value.y) / hexSize.value;
  return pixelToAxial(px, py, 1);
}

function handleClick(e: MouseEvent) {
  if (drawMode.value) return;
  const hex = eventToHex(e);
  if (!hex) return;
  const hexData = mapStore.getHex(hex.q, hex.r);
  mapStore.selectHex(hexData ?? null);
}

// --- Pheromone actions ---

function toggleDrawMode() {
  drawMode.value = !drawMode.value;
  if (!drawMode.value) {
    drawPoints.value = [];
    isDrawingPath.value = false;
  }
}

async function saveTrail() {
  pheromoneError.value = null;
  try {
    const result = await api.post('/pheromone/draw', {
      path: drawPoints.value,
      type: drawType.value,
    });
    activeTrails.value.push(result.data);
    drawPoints.value = [];
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    pheromoneError.value = err?.response?.data?.message || 'Failed to save trail';
  }
}

// --- Canvas rendering ---

let animFrame = 0;

function renderLoop() {
  draw();
  animFrame = requestAnimationFrame(renderLoop);
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const hs = hexSize.value;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(camera.value.x, camera.value.y);

  // Draw hexes
  for (const hex of mapStore.hexes) {
    const { x, y } = axialToPixel(hex.q, hex.r, hs);
    drawHex(ctx, x, y, hs, hex);
  }

  // Draw active pheromone trails
  for (const trail of activeTrails.value) {
    drawTrail(ctx, trail.path, trail.type, hs);
  }

  // Draw live drawings from clan members
  for (const live of liveDrawings.value) {
    if (live.partialPath.length >= 2) {
      drawTrail(ctx, live.partialPath, live.type, hs, 0.5);
    }
  }

  // Draw current drawing path
  if (drawMode.value && drawPoints.value.length >= 2) {
    drawTrail(ctx, drawPoints.value, drawType.value, hs, 0.8);
  }

  ctx.restore();

  if (mapStore.loading) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '14px monospace';
    ctx.fillText('Loading...', 10, h - 10);
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  path: HexCoord[],
  type: PheromoneType,
  size: number,
  alpha = 0.7,
) {
  if (path.length < 2) return;

  const isAttack = type === PheromoneType.ATTACK;
  const color = isAttack ? '255, 50, 30' : '50, 220, 60';
  const glowColor = isAttack ? '255, 80, 50' : '80, 255, 100';

  ctx.save();
  ctx.beginPath();

  // Build smooth path using midpoints
  const first = axialToPixel(path[0]!.q, path[0]!.r, size);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < path.length; i++) {
    const a = axialToPixel(path[i - 1]!.q, path[i - 1]!.r, size);
    const b = axialToPixel(path[i]!.q, path[i]!.r, size);

    if (i === 1) {
      // First segment: quadratic from start
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      ctx.lineTo(midX, midY);
    } else {
      // Smooth curve through midpoints
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      ctx.quadraticCurveTo(a.x, a.y, midX, midY);
    }
  }
  // Line to last point
  const last = path[path.length - 1]!;
  const lastPx = axialToPixel(last.q, last.r, size);
  ctx.lineTo(lastPx.x, lastPx.y);

  // Glow effect
  ctx.shadowColor = `rgba(${glowColor}, ${alpha})`;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = `rgba(${glowColor}, ${alpha * 0.6})`;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Core bright line
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${color}, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hex: MapHexData,
) {
  const corners = hexCorners(x, y, size);

  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(corners[i]!.x, corners[i]!.y);
  }
  ctx.closePath();

  switch (hex.type) {
    case HexType.LAKE:
      ctx.fillStyle = 'rgba(14, 80, 140, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 120, 200, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawIcon(ctx, x, y, size, '💧', 0.4);
      break;
    case HexType.MOUNTAIN:
      ctx.fillStyle = 'rgba(60, 50, 40, 0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 100, 80, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawIcon(ctx, x, y, size, '⛰', 0.5);
      break;
    case HexType.PVE_NEST:
      ctx.fillStyle = 'rgba(80, 10, 10, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 40, 20, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawIcon(ctx, x, y, size, '👾', 0.4);
      break;
    case HexType.HIVE:
      ctx.fillStyle = 'rgba(100, 10, 10, 0.3)';
      ctx.fill();
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 800);
      ctx.strokeStyle = hex.hiveId
        ? `rgba(255, ${Math.floor(40 + 20 * pulse)}, 40, ${0.6 + 0.3 * pulse})`
        : 'rgba(80, 30, 30, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawIcon(ctx, x, y, size, hex.hiveId ? '🏠' : '⬡', 0.3);
      break;
    case HexType.EMPTY:
    default:
      ctx.strokeStyle = 'rgba(40, 40, 40, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      break;
  }

  // Highlight selected hex
  if (mapStore.selectedHex && mapStore.selectedHex.q === hex.q && mapStore.selectedHex.r === hex.r) {
    ctx.beginPath();
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i]!.x, corners[i]!.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Coordinates on high zoom
  if (camera.value.zoom > 1.5) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${Math.max(8, size * 0.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${hex.q},${hex.r}`, x, y + size * 0.1);
  }
}

function hexCorners(x: number, y: number, size: number) {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({ x: x + size * Math.cos(angle), y: y + size * Math.sin(angle) });
  }
  return corners;
}

function drawIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, icon: string, scale: number) {
  const fontSize = Math.max(8, size * scale * 2);
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y);
}

// --- Attack panel ---
const showAttackPanel = ref(false);
const attackTarget = ref<MapHexData | null>(null);

function openAttackPanel() {
  if (!mapStore.selectedHex) return;
  attackTarget.value = mapStore.selectedHex;
  showAttackPanel.value = true;
}

function closeAttackPanel() {
  showAttackPanel.value = false;
  attackTarget.value = null;
}

const canAttackSelected = computed(() => {
  const hex = mapStore.selectedHex;
  if (!hex) return false;
  if (hex.type === 'PVE_NEST') return true;
  if (hex.type === 'HIVE' && hex.hiveId && hex.hiveId !== hiveStore.hiveId) return true;
  return false;
});

// Center on player hive
watch(
  () => hiveStore.hasHive,
  (ready) => {
    if (ready) {
      const { x, y } = axialToPixel(hiveStore.hiveQ, hiveStore.hiveR, HEX_SIZE_PX);
      camera.value.x = window.innerWidth / 2 - x;
      camera.value.y = window.innerHeight / 2 - y;
      loadViewport();
    }
  },
);
</script>

<template>
  <div class="fixed inset-0 bg-black">
    <canvas
      ref="canvasRef"
      class="absolute inset-0"
      :class="{
        'cursor-grab': !drawMode,
        'cursor-grabbing': isPanning,
        'cursor-crosshair': drawMode,
      }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @wheel="onWheel"
      @contextmenu.prevent
    />

    <!-- Error banner -->
    <div
      v-if="mapStore.error"
      class="absolute top-4 left-1/2 -translate-x-1/2 p-3 bg-red-950/80 border border-red-800 rounded-lg text-sm text-red-300 z-10"
    >
      {{ mapStore.error }}
    </div>

    <!-- Pheromone error -->
    <div
      v-if="pheromoneError"
      class="absolute top-14 left-1/2 -translate-x-1/2 p-2 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-300 z-10"
    >
      {{ pheromoneError }}
      <button class="ml-2 text-zinc-500 hover:text-zinc-300" @click="pheromoneError = null">✕</button>
    </div>

    <!-- Pheromone draw bar -->
    <div
      v-if="drawMode"
      class="absolute top-4 left-4 z-20 flex items-center gap-2 p-2 rounded-lg bg-black/80 border border-green-900/40 backdrop-blur-sm"
    >
      <button
        class="px-2 py-1 rounded text-xs font-medium transition-colors"
        :class="drawType === 'ATTACK' ? 'bg-red-900/60 text-red-300 border border-red-700/40' : 'bg-zinc-900/30 text-zinc-500 border border-zinc-800'"
        @click="drawType = PheromoneType.ATTACK"
      >
        🔴 Támadó
      </button>
      <button
        class="px-2 py-1 rounded text-xs font-medium transition-colors"
        :class="drawType === 'DEFEND' ? 'bg-green-900/60 text-green-300 border border-green-700/40' : 'bg-zinc-900/30 text-zinc-500 border border-zinc-800'"
        @click="drawType = PheromoneType.DEFEND"
      >
        🟢 Védekező
      </button>
      <span class="text-xs text-zinc-600">{{ drawPoints.length }} pont</span>
      <button
        v-if="drawPoints.length >= 2"
        class="px-2 py-1 rounded text-xs bg-green-900/40 border border-green-700/30 text-green-300 hover:bg-green-900/60"
        @click="saveTrail()"
      >
        Mentés
      </button>
      <button
        class="px-2 py-1 rounded text-xs bg-zinc-900/40 border border-zinc-700/30 text-zinc-400 hover:bg-zinc-900/60"
        @click="drawPoints = []"
      >
        Törlés
      </button>
      <button
        class="px-2 py-1 rounded text-xs text-zinc-600 hover:text-zinc-400"
        @click="toggleDrawMode()"
      >
        ✕ Kilépés
      </button>
    </div>

    <!-- Selected hex info panel -->
    <div
      v-if="mapStore.selectedHex"
      class="absolute bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 p-3 border border-red-950/40 bg-black/90 backdrop-blur-sm rounded-lg z-10 min-w-[200px]"
    >
      <div class="text-xs text-zinc-500 mb-1">
        Koordináta: ({{ mapStore.selectedHex.q }}, {{ mapStore.selectedHex.r }})
      </div>
      <div class="text-sm font-semibold" :class="{
        'text-red-400': mapStore.selectedHex.type === 'HIVE',
        'text-blue-400': mapStore.selectedHex.type === 'LAKE',
        'text-amber-500': mapStore.selectedHex.type === 'MOUNTAIN',
        'text-red-600': mapStore.selectedHex.type === 'PVE_NEST',
        'text-zinc-400': mapStore.selectedHex.type === 'EMPTY',
      }">
        {{
          mapStore.selectedHex.type === 'HIVE' ? '🏠 Kaptár' :
          mapStore.selectedHex.type === 'LAKE' ? '💧 Tó' :
          mapStore.selectedHex.type === 'MOUNTAIN' ? '⛰ Hegy' :
          mapStore.selectedHex.type === 'PVE_NEST' ? '👾 PvE Fészek' :
          '⬡ Üres mező'
        }}
      </div>
      <div v-if="mapStore.selectedHex.hiveName" class="text-xs text-zinc-400 mt-0.5">
        {{ mapStore.selectedHex.hiveName }}
      </div>
      <button
        v-if="canAttackSelected"
        class="mt-2 w-full py-1.5 rounded text-xs font-medium bg-red-900/40 border border-red-700/30 text-red-300 hover:bg-red-900/60 transition-colors"
        @click="openAttackPanel()"
      >
        ⚔️ Támadás
      </button>
      <button
        class="mt-2 text-xs text-zinc-600 hover:text-zinc-400"
        @click="mapStore.clearSelection()"
      >
        Bezár
      </button>
    </div>

    <!-- Pheromone draw mode toggle -->
    <div class="absolute top-4 right-16 z-10">
      <button
        class="px-2 py-1 rounded text-xs font-medium transition-all"
        :class="drawMode
          ? 'bg-green-900/50 border border-green-700/40 text-green-300'
          : 'bg-zinc-900/30 border border-zinc-800 text-zinc-500 hover:border-green-800/30 hover:text-green-400'"
        @click="toggleDrawMode()"
      >
        🧬 Feromon {{ drawMode ? 'ON' : 'OFF' }}
      </button>
    </div>

    <!-- Zoom controls -->
    <div class="absolute bottom-20 md:bottom-4 right-4 flex flex-col gap-1 z-10">
      <button
        class="w-8 h-8 flex items-center justify-center rounded bg-black/60 border border-red-950/30 text-zinc-400 hover:text-red-400 text-lg"
        @click="camera.zoom = Math.min(3, camera.zoom * 1.2); maybeReloadViewport()"
      >+</button>
      <button
        class="w-8 h-8 flex items-center justify-center rounded bg-black/60 border border-red-950/30 text-zinc-400 hover:text-red-400 text-lg"
        @click="camera.zoom = Math.max(0.3, camera.zoom * 0.8); maybeReloadViewport()"
      >−</button>
    </div>

    <AttackPanel v-if="showAttackPanel" :target="attackTarget" @close="closeAttackPanel()" />
    <CombatReport />
    <AttackNotification />
  </div>
</template>
