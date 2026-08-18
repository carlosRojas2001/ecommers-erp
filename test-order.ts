import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrdersService } from './src/orders/orders.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ordersService = app.get(OrdersService);

  const createOrderDto = {
    client_id: 37,
    document_type_id: 3,
    items: [
      { article_id: 8909, quantity: 1 }
    ]
  };

  console.log('Creando orden de prueba...');
  console.log('DTO:', JSON.stringify(createOrderDto, null, 2));

  try {
    const result = await ordersService.create(createOrderDto);
    console.log('\n=== RESULTADO ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }

  await app.close();
}

bootstrap();
