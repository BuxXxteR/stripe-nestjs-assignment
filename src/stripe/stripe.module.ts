import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { StripeRepository } from './repositories/stripe.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [StripeController],
  providers: [StripeService, UserRepository, StripeRepository],
})
export class StripeModule {}
