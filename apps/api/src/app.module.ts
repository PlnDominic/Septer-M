import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { InternalModule } from './internal/internal.module';
import { OrdersModule } from './orders/orders.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [SupabaseModule, CatalogModule, OrdersModule, AdminModule, InternalModule],
  controllers: [HealthController],
})
export class AppModule {}
