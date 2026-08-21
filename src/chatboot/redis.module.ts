import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') ||
          'redis://127.0.0.1:6380';

        const client = createClient({
          url: redisUrl,
        });

        client.on('error', (err) => {
          console.error('Redis Client Error:', err);
        });

        await client.connect();

        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}