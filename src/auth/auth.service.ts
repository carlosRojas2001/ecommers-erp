import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { ClientsService } from '../clients/clients.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { randomBytes } from 'crypto';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Shape returned by both /auth/login and /auth/google */
export interface AuthResponse {
  token: string;
  user: { id: number; name: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Registro de Clientes ──────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existingClient = await this.clientsService.findByEmail(dto.email);
    if (existingClient) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const client = await this.clientsService.create({
      names: dto.names,
      lastnames: dto.lastnames,
      email: dto.email,
      phone: dto.phone,
      document_type: dto.document_type,
      document_number: dto.document_number,
      password: hashedPassword,
    });

    return this.generateAuthResponse(client);
  }

  // ─── Login Estándar (Clientes) ─────────────────────────────────────────────
  async login(dto: LoginDto) {
    const client = await this.clientsService.findByEmail(dto.email);

    if (!client || !client.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, client.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateAuthResponse(client);
  }

  // ─── Google login (clientes) ────────────────────────────────────────────────
  async loginWithGoogle(idToken: string) {
    // 1. Verify the token with Google
    let payload: { email?: string; name?: string; sub?: string } | null = null;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload() ?? null;
    } catch {
      throw new UnauthorizedException('Token de Google inválido');
    }

    if (!payload?.email || !payload?.sub) {
      throw new UnauthorizedException('Token de Google inválido.');
    }

    const { email, name = email, sub: googleId } = payload;

    // 2. Find existing client or auto-create on first login
    let client = await this.clientsService.findByEmail(email);
    console.log(client);
    if (!client) {
      client = await this.clientsService.createFromGoogle({
        name,
        email,
        googleId,
      });
    }
    console.log(client);
    // 3. Issue JWT
    return this.generateAuthResponse(client);
  }

  // ─── Helper para generar respuesta ─────────────────────────────────────────
  private generateAuthResponse(client: any) {
    const numericId = Number(client.id);
    const username = `${client.names || ''} ${client.lastnames || ''}`.trim();

    const token = this.jwtService.sign({
      sub: numericId,
      email: client.email,
      username: username,
    });

    return {
      token,
      user: {
        id: numericId,
        username: username,
        email: client.email,
      },
    };
  }

  async loginAdminUpdateImage(username: string, password: string) {
    const user = await this.prisma.users.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no existe');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Password incorrecto');
    }

    if (user.username !== 'admin') {
      throw new UnauthorizedException('No eres administrador');
    }

    // 🔐 Generar JWT
    const payload = {
      sub: user.id,
      username: user.username,
      role: 'admin',
    };

    const token = this.jwtService.sign(payload);

    return {
      message: 'Login correcto',
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  async updateProfile(clientId: number, dto: UpdateClientDto) {
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    const updatedClient = await this.clientsService.update(clientId, data);
    return updatedClient;
  }

  async forgotPassword(email: string) {
    const client = await this.clientsService.findByEmail(email);
    if (!client) {
      throw new BadRequestException('El correo no está registrado');
    }

    const token = randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await this.clientsService.update(Number(client.id), {
      reset_token: token,
      reset_token_expires: expires,
    });

    // TODO: Send email with token
    return {
      message: 'Se ha enviado un correo para restablecer la contraseña',
      token,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const client = await this.prisma.clients.findFirst({
      where: {
        reset_token: token,
        reset_token_expires: { gt: new Date() },
      },
    });

    if (!client) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.clientsService.update(Number(client.id), {
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null,
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
