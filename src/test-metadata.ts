import { Injectable } from '@nestjs/common';
import 'reflect-metadata';

@Injectable()
class TestService {
  constructor(private readonly val: string) {}
}

async function main() {
  const types = Reflect.getMetadata('design:paramtypes', TestService);
  console.log('design:paramtypes:', types, '(expected: [String])');
}

main();
