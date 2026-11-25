import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { InternalModule } from './internal/internal.module';
import { OrdersModule } from './orders/orders.module';
import { SupabaseModule } from './supabase/supabase.module';
import { CommonModule } from './common/common.module';
import { EmailsModule } from './emails/emails.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [SupabaseModule, CommonModule, EmailsModule, CatalogModule, OrdersModule, PaymentsModule, NewsletterModule, ReviewsModule, AdminModule, InternalModule],
  controllers: [HealthController],
})
export class AppModule {}
