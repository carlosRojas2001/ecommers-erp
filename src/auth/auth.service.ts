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
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) { }

  // ─── Registro de Clientes ──────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    
    const existingClient = await this.clientsService.findByEmail(dto.email);
    if (existingClient) {
      throw new ConflictException('El correo ya está registrado');
    }

    if (!dto.captchaToken) {
    throw new BadRequestException(
      'Captcha requerido'
    );
  }

  const secret = this.configService.get<string>('RECAPTCHA_SECRET_KEY');

     try {

    const response =
      await firstValueFrom(
        this.httpService.post(
          'https://www.google.com/recaptcha/api/siteverify',
          null,
          {
            params: {
              secret,
              response: dto.captchaToken,
            },
          },
        ),
      ); 

    if (!response.data.success) {
      throw new BadRequestException(
        'Captcha inválido'
      );
    }

  } catch (error) {

  if (error instanceof BadRequestException) {
    throw error;
  }

  throw new BadRequestException(
    'Error verificando captcha'
  );
}

  // Continúa registro normal
  const hashedPassword =
    await bcrypt.hash(
      dto.password,
      10,
    );

    // const response = await this.httpService.axiosRef.get(
    //     `${process.env.EXTERNAL_API_URL}/${dto?.document_number}`,
    //     {
    //       headers: {
    //         Authorization: `Bearer ${process.env.PUBLICTOKEN}`,
    //       },
    //          validateStatus: () => true,
    //     },
        
    //   );
    //   //  console.log("estado",response.status)  
    //   if (dto.document_number !== "" ) {
    //       if (response?.status === 404) throw new UnauthorizedException('El dni no es correcto')   
    //       if (!response?.data?.success  ) throw new BadRequestException('El dni no es correcto')     
    //      if (!response?.data?.success  ) throw new BadRequestException('El dni no es correcto')
    //   }

  const client =
    await this.clientsService.create({
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

       if (!dto.captchaToken) {
    throw new BadRequestException(
      'Captcha requerido'
    );
  }
   
      const secret = this.configService.get<string>('RECAPTCHA_SECRET_KEY');

       try {

    const response =
      await firstValueFrom(
        this.httpService.post(
          'https://www.google.com/recaptcha/api/siteverify',
          null,
          {
            params: {
              secret,
              response: dto.captchaToken,
            },
          },
        ),
      );

    if (!response.data.success) {
      throw new BadRequestException(
        'Captcha inválido'
      );
    }

  } catch (error) {

  if (error instanceof BadRequestException) {
    throw error;
  }

  throw new BadRequestException(
    'Error verificando captcha'
  );
}


    if (!client || !client.password) {
      throw new UnauthorizedException('Email inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, client.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña inválidas');
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

    if (!client) {
      client = await this.clientsService.createFromGoogle({
        name,
        email,
        googleId,
      });
    }
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

    //  Generar JWT
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
    const expires = new Date(Date.now() + 3600000); 

    await this.clientsService.update(Number(client.id), {
      reset_token: token,
      reset_token_expires: expires,
    });

    // Configuración del servidor de correos (Ej: Gmail)
    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(this.configService.get('SMTP_PORT')) || 587,
      secure: this.configService.get('SMTP_SECURE') === 'true', // true para puerto 465
      auth: {
        user: this.configService.get<string>('SMTP_USER'), // Tu correo
        pass: this.configService.get<string>('SMTP_PASS'), // Contraseña de aplicación de tu correo
      },
    });

    // Link hacia tu frontend con el token de seguridad
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://192.168.18.35:3000/';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const smtpUser = this.configService.get<string>('SMTP_USER');

    try {
      await transporter.sendMail({
        from: `"Soporte ERP" <${smtpUser}>`,
        to: email, // El correo de la persona que olvidó su contraseña
        subject: 'Recuperación de contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="text-align: center; color: #333;">Restablecer tu contraseña</h2>
            <p>Hola,</p>
            <p>Hemos recibido una solicitud para cambiar la contraseña de tu cuenta. Haz clic en el siguiente botón para asignar una nueva:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer contraseña</a>
            </div>
            <p style="font-size: 14px; color: #555;">Este enlace es válido por 1 hora. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Error enviando correo:', error);
      throw new BadRequestException('Hubo un problema intentando enviar el correo electrónico. Por favor intenta más tarde o revisa tu configuración.');
    }

    return {
      message: 'Se ha enviado un correo con las instrucciones para restablecer la contraseña',
      token, // En producción puedes quitar el token del return para mayor seguridad
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
