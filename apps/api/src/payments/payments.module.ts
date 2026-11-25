import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';
import { StripeService } from './stripe.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [WebhooksController],
  providers: [PaymentsService, StripeService, PaystackService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
