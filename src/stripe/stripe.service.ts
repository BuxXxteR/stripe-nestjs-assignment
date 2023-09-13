import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateStripeSubscriptionDto } from './dtos/createStripeSubscription.dto';
import { UserRepository } from './repositories/user.repository';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { StripeRepository } from './repositories/stripe.repository';
import { CreateUserDto } from './dtos/createUser.dto';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly stripeRepository: StripeRepository,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SK'), {
      apiVersion: '2023-08-16',
    });
  }

  async createUser(createUserDto: CreateUserDto) {
    const createdUser = await this.userRepository.createUser(createUserDto);

    if (createdUser) {
      return createUserDto;
    }
  }

  async createMembership(
    createStripeSubscriptionDto: CreateStripeSubscriptionDto,
  ) {
    const {
      userId,
      amount,
      paymentMethodId,
      paymentType,
      priceId,
      country_code,
      savePaymentMethod,
    } = createStripeSubscriptionDto;

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new ForbiddenException(`User not found`);
    }

    if (!user.stripe_customer_id || user.stripe_customer_id === '') {
      const createdCustomerId = await this.stripeRepository.createCustomerId();

      if (createdCustomerId) {
        await this.userRepository.updateUserStripeCustomerId(
          createdCustomerId,
          user,
        );
      }
    }

    const updatedUser = await this.userRepository.findById(userId);

    const customer = await this.stripeRepository.retrieveCustomer(
      updatedUser.stripe_customer_id,
    );

    // const createdPaymentMethod =
    const createdPaymentMethod =
      await this.stripeRepository.createPaymentMethod();

    console.log(createdPaymentMethod, 'createdPaymentMethod');

    // if (updatedUser.stripe_customer_id && createdPaymentMethod) {
    //   const attchedPaymentMethod =
    //     await this.stripeRepository.attachPaymentMethodId(
    //       paymentMethodId,
    //       updatedUser.stripe_customer_id,
    //     );
    // }

    // const { default_source } = customer;

    // if (paymentMethodId !== default_source) {
    // }
  }
}
