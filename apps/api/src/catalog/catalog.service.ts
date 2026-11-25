import { Injectable, NotFoundException } from '@nestjs/common';
import { unwrap } from '../common/db-errors';
import { SupabaseService } from '../supabase/supabase.service';
import { filterProducts, PRODUCT_SELECT, toProductDto, type ProductFilter, type ProductRow } from './product.mapper';

@Injectable()
export class CatalogService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(filter: ProductFilter) {
    const rows = unwrap<ProductRow[]>(
      await this.supabase.admin.from('products').select(PRODUCT_SELECT).eq('status', 'active').order('created_at'),
    );
    return filterProducts(rows.map(toProductDto), filter);
  }

  async get(slug: string) {
    const row = unwrap<ProductRow | null>(
      await this.supabase.admin.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('status', 'active').maybeSingle(),
    );
    if (!row) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    return toProductDto(row);
  }
}
