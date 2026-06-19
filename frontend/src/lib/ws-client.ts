import { io, Socket } from 'socket.io-client';
import type { WsChatMessage } from '@a-raj/shared';
import { WsEvent } from '@a-raj/shared';

// Event callback types
export type ChatCallback = (msg: WsChatMessage) => void;
export type NotificationCallback = (data: {
  type: string;
  title: string;
  body: string;
}) => void;
export type AttackCallback = (data: {
  attackerName: string;
  attackerClan?: string;
  units: Array<{ unitType: string; count: number }>;
  arriveAt: string;
  targetHiveId: string;
}) => void;
export type ConnectedCallback = (data: {
  userId: string;
  username: string;
}) => void;

/**
 * Singleton WebSocket client with auto-reconnect.
 *
 * Usage:
 *   wsClient.connect(token);
 *   wsClient.onClanChat((msg) => { ... });
 *   wsClient.disconnect();
 */
class WsClient {
  private socket: Socket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private currentToken: string | null = null;
  private maxReconnectDelay = 30_000; // 30s max
  private baseReconnectDelay = 1_000; // 1s initial

  // Callback registries
  private clanChatCbs = new Set<ChatCallback>();
  private globalChatCbs = new Set<ChatCallback>();
  private privateMessageCbs = new Set<ChatCallback>();
  private notificationCbs = new Set<NotificationCallback>();
  private attackCbs = new Set<AttackCallback>();
  private connectedCbs = new Set<ConnectedCallback>();
  private disconnectCbs = new Set<() => void>();
  private genericCbs = new Map<string, Set<(data: unknown) => void>>();

  connect(token: string): void {
    if (this.socket?.connected) return;
    this.currentToken = token;

    const url =
      import.meta.env.VITE_WS_URL ??
      `${window.location.protocol}//${window.location.hostname}:3000`;

    this.socket = io(url, {
      auth: { token },
      reconnection: false, // We handle reconnection ourselves
      transports: ['websocket', 'polling'],
      timeout: 10_000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0; // Reset backoff on successful connection
      console.log('[WS] Connected:', this.socket?.id);
    });

    this.socket.on('connected', (data: { userId: string; username: string }) => {
      this.connectedCbs.forEach((cb) => cb(data));
    });

    this.socket.on(WsEvent.CLAN_CHAT, (msg: WsChatMessage) => {
      this.clanChatCbs.forEach((cb) => cb(msg));
    });

    this.socket.on(WsEvent.GLOBAL_CHAT, (msg: WsChatMessage) => {
      this.globalChatCbs.forEach((cb) => cb(msg));
    });

    this.socket.on(WsEvent.PRIVATE_MESSAGE, (msg: WsChatMessage) => {
      this.privateMessageCbs.forEach((cb) => cb(msg));
    });

    this.socket.on(
      WsEvent.ATTACK_INCOMING,
      (data: {
        attackerName: string;
        attackerClan?: string;
        units: Array<{ unitType: string; count: number }>;
        arriveAt: string;
        targetHiveId: string;
      }) => {
        this.attackCbs.forEach((cb) => cb(data));
      },
    );

    this.socket.on(
      WsEvent.NOTIFICATION,
      (data: { type: string; title: string; body: string }) => {
        this.notificationCbs.forEach((cb) => cb(data));
      },
    );

    this.socket.on('error', (err: { message?: string }) => {
      console.warn('[WS] Error:', err.message);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[WS] Disconnected:', reason);
      this.disconnectCbs.forEach((cb) => cb());

      // Auto-reconnect unless intentional
      if (reason !== 'io client disconnect' && this.currentToken) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (err: Error) => {
      console.warn('[WS] Connection error:', err.message);
      if (this.currentToken) {
        this.scheduleReconnect();
      }
    });
  }

  disconnect(): void {
    this.currentToken = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  reconnect(token: string): void {
    this.disconnect();
    this.currentToken = token;
    this.scheduleReconnect(0); // Immediate reconnect
  }

  private scheduleReconnect(delay?: number): void {
    if (this.reconnectTimer) return;
    const d =
      delay ??
      Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
        this.maxReconnectDelay,
      );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentToken) {
        this.connect(this.currentToken);
      }
    }, d);
  }

  // --- Event listeners ---

  onClanChat(cb: ChatCallback): () => void {
    this.clanChatCbs.add(cb);
    return () => this.clanChatCbs.delete(cb);
  }

  onGlobalChat(cb: ChatCallback): () => void {
    this.globalChatCbs.add(cb);
    return () => this.globalChatCbs.delete(cb);
  }

  onPrivateMessage(cb: ChatCallback): () => void {
    this.privateMessageCbs.add(cb);
    return () => this.privateMessageCbs.delete(cb);
  }

  onNotification(cb: NotificationCallback): () => void {
    this.notificationCbs.add(cb);
    return () => this.notificationCbs.delete(cb);
  }

  onAttack(cb: AttackCallback): () => void {
    this.attackCbs.add(cb);
    return () => this.attackCbs.delete(cb);
  }

  onConnected(cb: ConnectedCallback): () => void {
    this.connectedCbs.add(cb);
    return () => this.connectedCbs.delete(cb);
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectCbs.add(cb);
    return () => this.disconnectCbs.delete(cb);
  }

  emit(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, cb: (...args: any[]) => void): () => void {
    if (!this.genericCbs.has(event)) {
      this.genericCbs.set(event, new Set());
    }
    this.genericCbs.get(event)!.add(cb);

    // Register on the actual socket if connected
    this.socket?.on(event as never, cb);

    return () => {
      this.genericCbs.get(event)?.delete(cb);
    };
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsClient = new WsClient();
