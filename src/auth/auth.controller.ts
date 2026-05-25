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
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GetClient } from './decorators/get-client.decorator';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { LoginAdminDto } from './dto/login-admin.dto';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.register(body);
    this.setCookie(response, token);
    return { user, token, sunat_verfied:false };
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(body);
    this.setCookie(response, token);
    return { user, token };
  }

  @Post('google')
  async googleLogin(
    @Body() body: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.loginWithGoogle(body.token);
    this.setCookie(response, token);
    return { user, token };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
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
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  resetPassword(
    @Body('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
