import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateStripeSubscriptionDto } from './dtos/createStripeSubscription.dto';
import { UserRepository } from './repositories/user.repository';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { StripeRepository } from './repositories/stripe.repository';
import { CreateUserDto } from './dtos/createUser.dto';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentMethod, PaymentType, Status } from './types/payment.types';
import raw from 'raw-body';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly stripeRepository: StripeRepository,
    private readonly paymentRepository: PaymentRepository,
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
    // const createdPaymentMethod =
    //   await this.stripeRepository.createPaymentMethod();

    // console.log(createdPaymentMethod, 'createdPaymentMethod');

    if (updatedUser.stripe_customer_id) {
      await this.stripeRepository.attachPaymentMethodId(
        paymentMethodId,
        updatedUser.stripe_customer_id,
      );
    }

    const { default_source } = customer;

    if (paymentMethodId !== default_source) {
      const updatedDefaultPaymentMethod =
        await this.stripeRepository.updateDefaultPaymentmethod(
          updatedUser.id,
          paymentMethodId,
        );

      if (updatedDefaultPaymentMethod) {
        await this.userRepository.updateUserStripeDefaultPaymentMethod(
          updatedDefaultPaymentMethod.id,
          user,
        );
      }
    }

    const defaultPaymentMethodUpdatedUser =
      await this.userRepository.findById(userId);

    // Making payment subscription
    const subscriptionIntent = await this.stripeRepository.createSubscription(
      defaultPaymentMethodUpdatedUser,
    );

    if (subscriptionIntent) {
      const payment = await this.paymentRepository.createPayment({
        user: defaultPaymentMethodUpdatedUser,
        payment_id: subscriptionIntent?.id,
        amount: +subscriptionIntent.items.data[0].plan.amount / 100,
        payment_method: PaymentMethod.STRIPE,
        payment_type: PaymentType.YEARLY,
        expire_date: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toString(),
        create_date: subscriptionIntent.current_period_start.toString(),
        status: Status.PENDING,
        invoice_id:
          typeof subscriptionIntent?.latest_invoice == 'string'
            ? subscriptionIntent?.latest_invoice
            : typeof subscriptionIntent?.latest_invoice == 'object'
            ? (subscriptionIntent.latest_invoice as Stripe.Invoice)?.id
            : '',
      });

      if (!payment) {
        throw new Error(`payment not saved`);
      }

      return subscriptionIntent;
    }
  }

  async handleSubscriptionWebhook(data: Buffer, sig: string) {
    const membershipId = 1;

    const event = this.stripe.webhooks.constructEvent(
      data,
      sig,
      this.configService.get<string>('STRIPE_WEBHOOK_ENDPOINT_SK'),
    );

    console.log(event, 'event');

    if (!event?.id) {
      console.log(
        `event id not found eventId=${event?.id} time=${new Date().getTime()}`,
      );
      return;
    }

    const callbackData = JSON.parse(data.toString());

    switch (event.type) {
      case 'customer.subscription.created':
        console.log('customer.subscription.created');

        break;
      case 'customer.subscription.updated':
        console.log('customer.subscription.updated');

        break;

      case 'invoice.payment_failed':
        console.log('invoice.payment_failed');

        break;
      case 'invoice.payment_succeeded':
        console.log('invoice.payment_succeeded');

        break;
    }
  }
}
