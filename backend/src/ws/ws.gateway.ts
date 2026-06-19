import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { WsEvent } from '@a-raj/shared';
import type { AuthPayload, WsChatMessage } from '@a-raj/shared';
import type { HexCoord } from '@a-raj/shared';
import { PheromoneType } from '@a-raj/shared';

// Rate limiting: max events per second per socket
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 1000;

interface RateLimitEntry {
  timestamps: number[];
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 10000,
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();

  // Map: socketId → userId
  private readonly socketUsers = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Handle new WebSocket connection.
   * Authenticates via JWT in the handshake auth.token field.
   * Joins the user to their private room and clan room.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`Socket ${client.id}: no token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify JWT
      let payload: AuthPayload;
      try {
        payload = this.jwtService.verify<AuthPayload>(token);
      } catch {
        this.logger.warn(`Socket ${client.id}: invalid token`);
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect();
        return;
      }

      const userId = payload.userId;
      this.socketUsers.set(client.id, userId);

      // Join private user room
      client.join(`user:${userId}`);

      // Join clan room if user is in a clan
      const membership = await this.prisma.clanMember.findUnique({
        where: { userId },
      });
      if (membership) {
        client.join(`clan:${membership.clanId}`);
        this.logger.debug(
          `Socket ${client.id}: user ${payload.username} joined clan:${membership.clanId}`,
        );
      }

      // Join global room
      client.join('global');

      // Initialize rate limiter
      this.rateLimitMap.set(client.id, { timestamps: [] });

      this.logger.log(
        `Socket ${client.id}: user ${payload.username} (${userId}) connected`,
      );

      // Notify client of successful auth
      client.emit('connected', { userId, username: payload.username });
    } catch (err) {
      this.logger.error(`Socket ${client.id}: connection error`, err);
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection.
   * Cleans up rate limiter and socket-user mapping.
   */
  handleDisconnect(client: Socket): void {
    const userId = this.socketUsers.get(client.id);
    this.socketUsers.delete(client.id);
    this.rateLimitMap.delete(client.id);
    this.logger.log(
      `Socket ${client.id}: user ${userId ?? 'unknown'} disconnected`,
    );
  }

  // ==================== Message Handlers ====================

  /**
   * Chat message sent to clan room.
   */
  @SubscribeMessage(WsEvent.CLAN_CHAT)
  async handleClanChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ): Promise<void> {
    const userId = this.getUserId(client);
    if (!userId) return;
    if (!this.checkRateLimit(client.id)) return;

    const membership = await this.prisma.clanMember.findUnique({
      where: { userId },
      include: { user: { select: { username: true } } },
    });
    if (!membership) {
      client.emit('error', { message: 'You are not in a clan' });
      return;
    }

    if (!data.message?.trim()) return;

    const msg: WsChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromUserId: userId,
      fromUsername: membership.user.username,
      message: data.message.trim().slice(0, 500),
      sentAt: new Date().toISOString(),
    };

    this.server.to(`clan:${membership.clanId}`).emit(WsEvent.CLAN_CHAT, msg);
  }

  /**
   * Global chat message.
   */
  @SubscribeMessage(WsEvent.GLOBAL_CHAT)
  async handleGlobalChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ): Promise<void> {
    const userId = this.getUserId(client);
    if (!userId) return;
    if (!this.checkRateLimit(client.id)) return;
    if (!data.message?.trim()) return;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (!user) return;

      const msg: WsChatMessage = {
        id: `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fromUserId: userId,
        fromUsername: user.username,
        message: data.message.trim().slice(0, 500),
        sentAt: new Date().toISOString(),
      };
      this.server.to('global').emit(WsEvent.GLOBAL_CHAT, msg);
    } catch (err) {
      this.logger.error('Global chat lookup failed', err);
    }
  }

  /**
   * Private message to another user.
   */
  @SubscribeMessage(WsEvent.PRIVATE_MESSAGE)
  async handlePrivateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; message: string },
  ): Promise<void> {
    const userId = this.getUserId(client);
    if (!userId) return;
    if (!this.checkRateLimit(client.id)) return;
    if (!data.toUserId || !data.message?.trim()) return;

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (!user) return;

      const msg: WsChatMessage = {
        id: `pmsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fromUserId: userId,
        fromUsername: user.username,
        message: data.message.trim().slice(0, 500),
        sentAt: new Date().toISOString(),
      };
      // Send to recipient's private room
      this.server.to(`user:${data.toUserId}`).emit(WsEvent.PRIVATE_MESSAGE, msg);
      // Also echo back to sender
      client.emit(WsEvent.PRIVATE_MESSAGE, msg);
    } catch (err) {
      this.logger.error('Private message lookup failed', err);
    }
  }

  /**
   * Handle real-time pheromone drawing (streaming preview during mouse drag).
   * Broadcasts the partial path to all clan members for live visualization.
   */
  @SubscribeMessage(WsEvent.PHEROMONE_DRAW)
  handlePheromoneDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partialPath: HexCoord[]; type: string },
  ): void {
    const userId = this.getUserId(client);
    if (!userId) return;
    if (!this.checkRateLimit(client.id)) return;
    if (!data.partialPath?.length || !data.type) return;

    // Find user's clan and verify role (OFFICER or LEADER)
    this.prisma.clanMember
      .findUnique({ where: { userId } })
      .then((membership) => {
        if (!membership) return;
        if (membership.role !== 'LEADER' && membership.role !== 'OFFICER') {
          client.emit('error', {
            message: 'Only Leader or Officer can draw pheromone trails',
          });
          return;
        }

        // Broadcast the live drawing to the clan room
        this.server
          .to(`clan:${membership.clanId}`)
          .emit(WsEvent.PHEROMONE_VISIBLE, {
            userId,
            partialPath: data.partialPath,
            type: data.type as PheromoneType,
          });
      })
      .catch((err) =>
        this.logger.error('Pheromone draw broadcast failed', err),
      );
  }

  /**
   * Broadcast a combat notification to a specific user.
   * Called by CombatService when combat resolves against a player's hive.
   */
  sendAttackNotification(
    targetUserId: string,
    notification: {
      attackerName: string;
      attackerClan?: string;
      units: Array<{ unitType: string; count: number }>;
      arriveAt: string;
      targetHiveId: string;
    },
  ): void {
    this.server
      .to(`user:${targetUserId}`)
      .emit(WsEvent.ATTACK_INCOMING, notification);
  }

  /**
   * Send a generic notification to a user.
   */
  sendNotification(
    userId: string,
    notification: { type: string; title: string; body: string },
  ): void {
    this.server
      .to(`user:${userId}`)
      .emit(WsEvent.NOTIFICATION, notification);
  }

  // ==================== Helpers ====================

  /**
   * Get authenticated userId from socket.
   */
  private getUserId(client: Socket): string | undefined {
    const userId = this.socketUsers.get(client.id);
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
    }
    return userId;
  }

  /**
   * Simple sliding-window rate limiter.
   * Returns true if the request is allowed, false if rate limited.
   */
  private checkRateLimit(socketId: string): boolean {
    const entry = this.rateLimitMap.get(socketId);
    if (!entry) return true;

    const now = Date.now();
    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(
      (t) => now - t < RATE_WINDOW_MS,
    );

    if (entry.timestamps.length >= RATE_LIMIT) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }
}
