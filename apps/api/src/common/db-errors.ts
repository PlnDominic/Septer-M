import { ConflictException, ForbiddenException, HttpException, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

interface DbError {
  message: string;
  details?: string | null;
  code?: string;
}

/**
 * Turns an error from a Supabase call into an HTTP error. Our SQL functions raise
 * stable codes (OUT_OF_STOCK, INVALID_TRANSITION, ...) with the subject in `details`.
 * Anything unrecognised is logged and returned as a generic 500 so internals never leak.
 */
export function toHttpError(error: DbError): HttpException {
  const detail = error.details ?? undefined;
  const body = (code: string, message: string) => ({ code, message, detail });

  switch (error.message) {
    case 'EMPTY_CART':
      return new UnprocessableEntityException(body('EMPTY_CART', 'Your bag is empty.'));
    case 'INVALID_QUANTITY':
      return new UnprocessableEntityException(body('INVALID_QUANTITY', 'Choose between 1 and 20 of each product.'));
    case 'PRODUCT_UNAVAILABLE':
    case 'NO_PRICE':
      return new UnprocessableEntityException(body('PRODUCT_UNAVAILABLE', 'A product in your bag is no longer available.'));
    case 'UNKNOWN_CATEGORY':
      return new UnprocessableEntityException(body('UNKNOWN_CATEGORY', 'That category does not exist.'));
    case 'OUT_OF_STOCK':
      return new ConflictException(body('OUT_OF_STOCK', 'Not enough stock for a product in your bag.'));
    case 'PRICE_CHANGED':
      return new ConflictException(body('PRICE_CHANGED', 'A price changed while you were checking out. Please review your bag.'));
    case 'INVALID_TRANSITION':
      return new ConflictException(body('INVALID_TRANSITION', 'The order cannot move to that status.'));
    case 'ORDER_NOT_FOUND':
      return new NotFoundException(body('ORDER_NOT_FOUND', 'Order not found.'));
    case 'PRODUCT_NOT_FOUND':
      return new NotFoundException(body('PRODUCT_NOT_FOUND', 'Product not found.'));
    case 'REVIEW_NOT_FOUND':
      return new NotFoundException(body('REVIEW_NOT_FOUND', 'Review not found.'));
    case 'DISCOUNT_INVALID':
      return new UnprocessableEntityException(body('PROMO_INVALID', 'That promo code can’t be used.'));
    case 'INVALID_EMAIL':
      return new UnprocessableEntityException(body('INVALID_EMAIL', 'Enter a valid email address.'));
    case 'NOT_PURCHASED':
      return new ForbiddenException(body('NOT_PURCHASED', 'Only customers who received this product can review it.'));
    case 'ALREADY_REVIEWED':
      return new ConflictException(body('ALREADY_REVIEWED', 'You have already reviewed this product.'));
  }
  if (error.code === '23505') return new ConflictException(body('DUPLICATE', 'That already exists.'));
  if (error.code === '23503') return new ConflictException(body('IN_USE', 'That is still in use.'));

  console.error('[db] unexpected error', { message: error.message, code: error.code, details: error.details });
  return new InternalServerErrorException({ code: 'INTERNAL_ERROR', message: 'Something went wrong.' });
}

/** Throw if a Supabase response carries an error; otherwise return its data. */
export function unwrap<T>(res: { data: T | null; error: DbError | null }): T {
  if (res.error) throw toHttpError(res.error);
  return res.data as T;
}
