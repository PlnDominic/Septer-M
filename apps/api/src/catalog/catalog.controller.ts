import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { CatalogService } from './catalog.service';

const listQuery = z.object({
  category: z.string().max(40).optional(),
  collection: z.enum(['new', 'best']).optional(),
  q: z.string().max(100).optional(),
});

@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodPipe(listQuery)) query: z.output<typeof listQuery>) {
    return this.catalog.list(query);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.catalog.get(slug);
  }
}
