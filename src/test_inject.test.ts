import { Injectable } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Injectable()
class TestService {
  constructor(private config: ConfigService) {
    console.log('ConfigService injected:', config ? 'OK' : 'NULL/UNDEFINED');
    console.log('config.get(JWT_ACCESS_EXPIRATION):', config?.get<string>('JWT_ACCESS_EXPIRATION'));
  }
}

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })],
  providers: [TestService],
  exports: [TestService],
})
export class TestModule {}

NestFactory.create(TestModule).then(() => {
  console.log('SUCCESS: Nest app created with ConfigService DI');
  process.exit(0);
}).catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
