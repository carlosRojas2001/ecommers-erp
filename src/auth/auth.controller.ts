import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Res,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GetClient } from './decorators/get-client.decorator';
import { TokenRevocationService } from './revocation/revocation.service';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { BruteForceInterceptor } from './brute-force/brute-force.interceptor';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenRevocation: TokenRevocationService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 registros/min por IP
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.register(body);
    this.setCookie(response, token);
    return { user, token, sunat_verfied:false };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos/min por IP (anti fuerza bruta)
  @UseInterceptors(BruteForceInterceptor)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(body);
    this.setCookie(response, token);
    return { user, token };
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async googleLogin(
    @Body() body: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.loginWithGoogle(body.token);
    this.setCookie(response, token);
    return { user, token };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@GetClient() client: any, @Res({ passthrough: true }) response: Response) {
    if (client?.jti) {
      // exp viene en segundos; convertimos a ms para el auto-limpieza de la denylist
      const expMs = (client.exp ?? Math.floor(Date.now() / 1000) + 3600) * 1000;
      this.tokenRevocation.revoke(client.jti, expMs);
    }
    response.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return { message: 'Sesión cerrada correctamente.' };
  }

  private setCookie(response: Response, token: string) {
    response.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
  }

  /**
   * GET /auth/profile
   * Protegido con JWT. Retorna la info del cliente logueado.
   */
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@GetClient() client: any) {
    return client;
  }

  @Post('login-admin')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos/min por IP (anti fuerza bruta admin)
  @UseInterceptors(BruteForceInterceptor)
  async loginAdmin(
    @Body() dto: LoginAdminDto,
    @Res({ passthrough: true }) response: Response,
  ) {

    const { message, token, user } =
      await this.authService.loginAdminUpdateImage(dto.username, dto.password);
    this.setCookie(response, token);
    return { message, user, token };
  }

  // @Post('upload-image-admin')
  // async uploadImageAdmin(
  //   @Body() body: GoogleAuthDto,
  //   @Res({ passthrough: true }) response: Response,
  // ) {
  //   const { token, user } = await this.authService.loginWithGoogle(body.token);
  //   this.setCookie(response, token);
  //   return { user };
  // }
  //reseñas y comentarios,
  // editar cliente, recuperar contraseña

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  updateProfile(@GetClient() client: any, @Body() dto: UpdateClientDto) {
    return this.authService.updateProfile(Number(client.id), dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 solicitudes/min por IP (anti email-bombing)
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos/min por IP
  resetPassword(
    @Body('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
