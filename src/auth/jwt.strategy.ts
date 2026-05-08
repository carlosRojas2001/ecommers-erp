import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly clientsService: ClientsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          return request?.cookies?.jwt || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Fallback por si acaso
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // Si el payload tiene role: 'admin', es un usuario administrador de la tabla 'users'
    if (payload.role === 'admin') {
      return {
        id: payload.sub,
        username: payload.username,
        role: 'admin',
      };
    }

    // De lo contrario, buscamos en la tabla de clientes
    const client: any = await this.clientsService.findByEmail(payload.email);

    if (!client) {
      throw new UnauthorizedException('Cliente no encontrado');
    }

    // Retornamos el objeto con el rol que tenga en la tabla (si se agregó) o 'client' por defecto
    return {
      id: Number(client.id),
      email: client.email,
      name: `${client.names || ''} ${client.lastnames || ''}`.trim(),
      role: client.role || 'client',
    };
  }
}
