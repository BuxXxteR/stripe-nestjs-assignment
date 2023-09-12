import { Controller, Post } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { CreateStripeSubscriptionDto } from './dtos/createStripeSubscription.dto';
import { PaymentType } from './types/payment.types';
import { CreateUserDto } from './dtos/createUser.dto';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-user')
  async createUser() {
    const createUserDto: CreateUserDto = {
      first_name: 'Nipuna',
      last_name: 'Amaranayaka',
      email: 'amaranayakanipuna@gmail.com',
      password: 'Nipuna@123',
    };

    const createdUser = await this.stripeService.createUser(createUserDto);

    if (createdUser) {
      return {
        success: true,
        message: 'User created',
      };
    }
  }

  // Create subscription controller
  // URL : /stripe/create-subscription
  @Post('create-subscription')
  async createSubscription() {
    // @Body() createMembershipStripeDto: CreateMembershipStripeDto,
    const createStripeSubscriptionDto: CreateStripeSubscriptionDto = {
      userId: '79b54e33-61d9-4166-afdc-0634a8bdc7b0',
      amount: 50,
      paymentMethodId: 'pm_1NpUm0Ap5WSNbPsaKYGLA2hR',
      paymentType: PaymentType.MONTHLY,
      priceId: 'priceIdNo123',
      country_code: 'LK',
      savePaymentMethod: true,
    };

    console.log('create-subscription');
    return await this.stripeService.createMembership(
      createStripeSubscriptionDto,
    );
  }
}
