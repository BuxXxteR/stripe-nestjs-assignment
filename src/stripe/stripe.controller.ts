import { Controller, Post } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { CreateMembershipStripeDto } from './dtos/createSubscription.dto';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  // Create subscription controller
  // URL : /stripe/create-subscription

  @Post('create-subscription')
  async createSubscription() {
    // @Body() createMembershipStripeDto: CreateMembershipStripeDto,

    const createSubscriptionDto: CreateMembershipStripeDto = {
      userId: 'abcdef123',
      amount: 50,
    };

    return await this.stripeService.createMembership(createSubscriptionDto);
  }
}
