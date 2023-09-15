import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateStripeSubscriptionDto } from './dtos/createStripeSubscription.dto';
import { UserRepository } from './repositories/user.repository';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { StripeRepository } from './repositories/stripe.repository';
import { CreateUserDto } from './dtos/createUser.dto';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentMethod, PaymentType, Status } from './types/payment.types';

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

    if (!event?.id) {
      console.log(
        `event id not found eventId=${event?.id} time=${new Date().getTime()}`,
      );
      return;
    }

    const callbackData = JSON.parse(data.toString());

    switch (event.type) {
      case 'customer.subscription.created':
        //check subscription id
        if (!callbackData.data.object?.id) {
          console.log(
            `subscription id not found eventId=${event?.id} subscriptionId=${callbackData
              .data.object
              ?.id} event=${`customer.subscription.created`}  time=${new Date().getTime()}`,
          );
          return;
        }
        if (callbackData.data.object.status !== 'active') {
          console.log(
            `subscription status not active eventId=${event?.id} subscriptionId=${callbackData
              .data.object
              ?.id} event=${`customer.subscription.created`}  time=${new Date().getTime()}`,
          );
          return;
        }
        if (callbackData.data.object.latest_invoice) {
          console.log(
            `Invoice id at creation ${callbackData.data.object.latest_invoice}`,
          );
        }
        if (!callbackData.data?.object?.id) {
          return;
        }
        const payment_created = await this.paymentRepository.findOneByPaymentId(
          callbackData.data.object?.id,
        );

        if (!payment_created[0]?.id) {
          console.log(
            `payment id not found eventId=${event?.id} userId=${payment_created[0]
              .user?.id} subscriptionId=${callbackData.data.object
              ?.id} event=${`customer.subscription.created`}  time=${new Date().getTime()}`,
          );
          return;
        } else {
          if (
            payment_created[0].status == Status.ACTIVE ||
            payment_created[0].status == Status.CANCELLED
          ) {
            console.log(
              `payment status not pending status=${
                payment_created[0].status
              } eventId=${event?.id} userId=${payment_created[0].user
                ?.id} subscriptionId=${callbackData.data.object
                ?.id} event=${`customer.subscription.created`}  time=${new Date().getTime()}`,
            );
            return;
          }
        }

        this.paymentRepository
          .updatePayment(payment_created[0], Status.PENDING)
          .then(async (res) => {
            await this.userRepository.findById(payment_created[0].user?.id);
          })
          .catch((error) => {
            console.log(
              `Payment status update error ${payment_created[0].payment_id} ${
                Status.PENDING
              } userId=${payment_created[0].user
                ?.id} time=${new Date().getTime()} error=${error} `,
            );
          });
        break;
      case 'customer.subscription.updated':
        if (!callbackData.data.object?.id) {
          console.log(
            `subscription id not found eventId=${event?.id} subscriptionId=${callbackData
              .data.object
              ?.id} event=${`customer.subscription.updated`}  time=${new Date().getTime()}`,
          );
          return;
        }
        if (callbackData.data.object.status !== 'active') {
          console.log(
            `subscription status not active eventId=${event?.id} subscriptionId=${callbackData
              .data.object
              ?.id} event=${`customer.subscription.updated`}  time=${new Date().getTime()}`,
          );
          return;
        }
        console.log(
          callbackData.data.object,
          'customer.subscription.updated event',
        );
        const payment_updated = await this.paymentRepository.findOneByPaymentId(
          callbackData.data.object?.id,
        );

        if (!payment_updated[0]?.id) {
          console.log(
            `payment id not found eventId=${event?.id} userId=${payment_updated[0]
              .user?.id} subscriptionId=${callbackData.data.object
              ?.id} event=${`customer.subscription.updated`}  time=${new Date().getTime()}`,
          );
          return;
        }
        //please check this is correct
        payment_updated[0].invoice_id =
          callbackData.data.object?.latest_invoice;
        this.paymentRepository
          .updatePayment(payment_updated[0], Status.ACTIVE)
          .then(async (payment_res) => {
            console.log(
              `Payment status updated eventId=${event?.id} userId=${payment_updated[0]
                .user?.id} subscriptionId=${callbackData.data.object
                ?.id} event=${`customer.subscription.updated`} status=${
                Status.ACTIVE
              } time=${new Date().getTime()} `,
            );
            const user = await this.userRepository.findById(
              payment_updated[0].user?.id,
            );

            await this.userRepository
              .updateUser(user)
              .then((res) => {
                const subscription = callbackData.data.object;
                const prevoiusSubscription =
                  callbackData.data.previous_attributes;
                console.log(
                  `user updated eventId=${event?.id} userId=${payment_updated[0]
                    .user?.id} subscriptionId=${callbackData.data.object
                    ?.id} event=${`customer.subscription.updated`} time=${new Date().getTime()} `,
                );
                if (
                  subscription.current_period_end >
                  prevoiusSubscription.current_period_end
                ) {
                  //callbackData.data.object.latest_invoice is the correct invoice Id. the  MailRenewalCompleted Invoice Id Should update with this email

                  // this.mailService.MailRenewalCompleted(
                  //   res,
                  //   payment_res,
                  //   membership,
                  //   callbackData.data.object?.latest_invoice,
                  // );
                  console.log(
                    `MailRenewalCompleted eventId=${event?.id} userId=${payment_updated[0]
                      .user?.id} subscriptionId=${callbackData.data.object
                      ?.id} event=${`customer.subscription.updated`} time=${new Date().getTime()} `,
                  );
                }
              })
              .catch((error) => {
                console.log(
                  `user update error eventId=${event?.id} userId=${payment_updated[0]
                    .user?.id} subscriptionId=${callbackData.data.object
                    ?.id} event=${`customer.subscription.updated`}  time=${new Date().getTime()} error=${error} `,
                );
              });
          })
          .catch((error) => {
            console.log(
              `Payment status update error eventId=${event?.id} userId=${payment_updated[0]
                .user?.id} subscriptionId=${callbackData.data.object
                ?.id} event=${`customer.subscription.updated`} time=${new Date().getTime()} error=${error} `,
            );
          });
        break;

      case 'invoice.payment_failed':
        console.log(
          `invoice created ${
            (new Date(), (callbackData.data.object as Stripe.Invoice)?.id)
          } status=${(callbackData.data.object as Stripe.Invoice)?.status}`,
        );
        if ((callbackData.data.object as Stripe.Invoice)?.id) {
          // const invoice = await this.invoiceRepository.findOneByInvoiceId(
          //   (callbackData.data.object as Stripe.Invoice)?.id,
          // );
          // if (invoice.length == 0) {
          //   console.log(
          //     `Invoice not found for invoiceId=${(
          //       callbackData.data.object as Stripe.Invoice
          //     )?.id} time=${new Date().getTime()}`,
          //   );
          // }
          // await this.invoiceRepository.updateInvoice(
          //   invoice[0],
          //   InvoiceStatus.FAILED,
          // );
          // console.log(`Invoice.payment_failed ${invoice[0]?.id}`);
        }
        //check subscription id
        if (!callbackData.data.object.subscription) {
          console.log(
            `subscription id not found eventId=${event?.id} subscriptionId=${callbackData
              .data.object
              ?.id} event=${`invoice.payment_failed`}  time=${new Date().getTime()}`,
          );
          return;
        }
        //update payment table
        const payment_failed = await this.paymentRepository.findOneByPaymentId(
          callbackData.data.object.subscription,
        );

        if (!payment_failed[0]?.id) {
          console.log(
            `payment id not found eventId=${event?.id} userId=${payment_failed[0]
              .user?.id} subscriptionId=${callbackData.data.object
              ?.id} event=${`invoice.payment_failed`}  time=${new Date().getTime()}`,
          );
          return;
        }

        this.paymentRepository
          .updatePayment(payment_failed[0], Status.REJECTED)
          .then(async (res) => {
            const user = await this.userRepository.findById(
              payment_failed[0].user?.id,
            );
            // const membership =
            //   await this.membershipRepository.findById(membershipId);
            // if (!membership) {
            //   console.log(
            //     `membership id not found eventId=${event?.id} subscriptionId=${callbackData
            //       .data.object?.id} userId=${payment_failed[0].user
            //       ?.id} event=${`invoice.payment_failed`}  time=${new Date().getTime()}`,
            //   );
            //   throw new NotFoundException(
            //     `Not found membership id ${membershipId}`,
            //   );
            // }
            // user.membership = null;
            const updatedUser = await this.userRepository.updateUser(user);

            if (updatedUser) {
              if (
                callbackData.data.object.subscription &&
                callbackData.data.object.status == 'open' &&
                callbackData.data.object.lines.data.length == 1 &&
                callbackData.data.object.lines.data[0].type == 'subscription'
              ) {
                // await this.mailService.payment_renewal_failed(updatedUser);
                console.log(
                  `MailPaymentFailed eventId=${event?.id} userId=${payment_failed[0]
                    .user?.id} subscriptionId=${callbackData.data.object
                    ?.id} event=${`invoice.payment_failed`} time=${new Date().getTime()} `,
                );
              }
            }
            console.log(
              `Payment status update eventId=${event?.id} userId=${payment_failed[0]
                .user?.id} subscriptionId=${callbackData.data.object
                ?.id} event=${`invoice.payment_failed`} time=${new Date().getTime()} `,
            );
          })
          .catch((error) => {
            console.log(
              `Payment status update error eventId=${event?.id} userId=${payment_failed[0]
                .user?.id} subscriptionId=${callbackData.data.object
                ?.id} event=${`invoice.payment_failed`} time=${new Date().getTime()} `,
            );
          });
        break;
      case 'invoice.payment_succeeded':
        console.log(
          `invoice created ${
            (new Date(),
            typeof callbackData.data.object == 'object'
              ? (callbackData.data.object as Stripe.Invoice)?.id
              : callbackData.data.object)
          } status=${(callbackData.data.object as Stripe.Invoice)?.status}`,
        );
        if (!callbackData.data?.object?.subscription) {
          console.log(
            `subscription id not found eventId=${event?.id} subscriptionId=${callbackData
              ?.data?.object
              ?.id} event=${`invoice.payment_succeeded`}  time=${new Date().getTime()}`,
          );
          return;
        }
        if (callbackData?.data?.object?.status !== 'paid') {
          console.log(
            `subscription status not paid eventId=${event?.id} subscriptionId=${callbackData
              ?.data?.object
              ?.id} event=${`invoice.payment_succeeded`}  time=${new Date().getTime()}`,
          );
          return;
        }
        //update payment table
        const payment_succeeded =
          await this.paymentRepository.findOneByPaymentId(
            callbackData.data?.object?.subscription,
          );

        if (!payment_succeeded[0]?.id) {
          console.log(
            `payment id not found eventId=${event?.id} userId=${payment_succeeded[0]
              .user?.id} subscriptionId=${callbackData.data.object
              ?.id} event=${`invoice.payment_succeeded`}  time=${new Date().getTime()}`,
          );
          return;
        }

        await this.paymentRepository.updatePayment(
          payment_succeeded[0],
          Status.ACTIVE,
        );
        const user = await this.userRepository.findById(
          payment_succeeded[0].user?.id,
        );
        // const membership =
        //   await this.membershipRepository.findById(membershipId);
        // if (!membership) {
        //   console.log(
        //     `membership id not found eventId=${event?.id} subscriptionId=${callbackData
        //       .data.object?.id} userId=${payment_succeeded[0].user
        //       ?.id} event=${`invoice.payment_succeeded`}  time=${new Date().getTime()}`,
        //   );
        //   throw new NotFoundException(
        //     `Not found membership id ${membershipId}`,
        //   );
        // }
        // user.membership = 1;
        const updatedUser = await this.userRepository.updateUser(user);

        // const vatDetails = await this.vatRepository.findOneByCountryCode(
        //   updatedUser.country_code.toUpperCase(),
        // );

        // console.log(
        //   'updatedUser',
        //   updatedUser.country_code,
        //   updatedUser.country_states_code,
        // );

        // const vatDetails = await this.vatService.findByCountryCode(
        //   updatedUser.country_code,
        //   updatedUser.country_states_code,
        // );

        // if (vatDetails.length !== 1) {
        //   console.log(`NO vat Detail found to this userId ${updatedUser.id}`);
        // }

        // console.log('vatDetails last', vatDetails);

        if (updatedUser) {
          // this.mailService.MailPaymentComplete(
          //   updatedUser,
          //   payment_succeeded[0],
          //   membership,
          //   vatDetails[0],
          // );

          // const renewDate = await this.getSubscriptionRenewDate(
          //   payment_succeeded[0].payment_id,
          // );

          // this.mailService.MailPaymentCompleteDateDetails(
          //   updatedUser,
          //   payment_succeeded[0],
          //   renewDate,
          //   membership,
          //   vatDetails[0],
          // );
          console.log(
            `MailPaymentComplete eventId=${event?.id} userId=${payment_succeeded[0]
              .user?.id} subscriptionId=${callbackData.data.object
              ?.id} event=${`invoice.payment_succeeded`} time=${new Date().getTime()} `,
          );
        }
        break;
    }
  }
}
