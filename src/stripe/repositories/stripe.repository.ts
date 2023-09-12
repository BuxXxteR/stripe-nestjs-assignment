import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { ICustomer } from '../types/stripe.types';

@Injectable()
export class StripeRepository {
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SK'), {
      apiVersion: '2023-08-16',
    });
  }

  // Create customer Id
  async createCustomerId() {
    try {
      const response = await this.stripe.customers.create({
        name: 'Nipuna',
        email: 'amaranayakanipuna@gmail.com',
        address: {
          city: '',
          country: '',
          line1: '',
          line2: '',
          postal_code: '',
        },
        phone: '',
      });

      return response.id;
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  }

  // Retrieve a customer
  async retrieveCustomer(customerId: string) {
    const customer = (await this.stripe.customers.retrieve(
      customerId,
    )) as ICustomer;
    if (!customer?.id) {
      throw new ForbiddenException(
        `cannot get the customer ${customerId} at this time`,
      );
    }
    return customer;
  }
}
