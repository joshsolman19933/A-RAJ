import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createRequire } from 'node:module';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto, LoginDto } from './dto/index.js';
import { PremiumTier } from '@a-raj/shared';
import type { LoginResponse, AuthPayload } from '@a-raj/shared';

const require = createRequire(import.meta.url);
const bcrypt: typeof import('bcryptjs') = require('bcryptjs');

function sha256(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<LoginResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        premiumTier: PremiumTier.FREE,
      },
    });

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      premiumTier: user.premiumTier as PremiumTier,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = await this.generateRefreshToken(user.id);

    return { token: accessToken, refreshToken, user: payload };
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      premiumTier: user.premiumTier as PremiumTier,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = await this.generateRefreshToken(user.id);

    return { token: accessToken, refreshToken, user: payload };
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    // Look up by SHA-256 hash of the plaintext token
    const tokenHash = sha256(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({
          where: { id: stored.id },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Delete the used refresh token (token rotation)
    await this.prisma.refreshToken.delete({
      where: { id: stored.id },
    });

    const payload: AuthPayload = {
      userId: stored.user.id,
      username: stored.user.username,
      premiumTier: stored.user.premiumTier as PremiumTier,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = await this.generateRefreshToken(stored.user.id);

    return { token: accessToken, refreshToken: newRefreshToken, user: payload };
  }

  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const plainToken = crypto.randomUUID();
    const tokenHash = sha256(plainToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId,
        expiresAt,
      },
    });

    // Return the plaintext token to the client (only the hash is stored)
    return plainToken;
  }
}
