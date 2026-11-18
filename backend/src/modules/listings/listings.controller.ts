/**
 * /api/v1/listings — service offers and job requests (FR-101…103, FR-150…152).
 *
 * | Endpoint                         | Who                        | Body / query               | Success |
 * |----------------------------------|----------------------------|----------------------------|---------|
 * | GET   /listings                  | signed in                  | searchListingsSchema       | 200 Page<ListingSummaryDto> |
 * | GET   /listings/:id              | signed in (others: ACTIVE only) | listingDetailQuerySchema (lat,lng) | 200 ListingDetailDto |
 * | POST  /listings                  | signed in + verified email | createListingSchema        | 201 ListingDetailDto |
 * | PATCH /listings/:id              | owner                      | updateListingSchema        | 200 ListingDetailDto |
 * | POST  /listings/:id/pause        | owner                      | —                          | 200 (ACTIVE→PAUSED) |
 * | POST  /listings/:id/resume       | owner                      | —                          | 200 (PAUSED→ACTIVE) |
 * | POST  /listings/:id/close        | owner                      | —                          | 200 (→CLOSED, final; open quotes → NOT_SELECTED) |
 * | GET   /me/listings               | signed in                  | myListingsSchema           | 200 Page<ListingSummaryDto> (all statuses) |
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createListingSchema,
  idParamSchema,
  listingDetailQuerySchema,
  myListingsSchema,
  searchListingsSchema,
  updateListingSchema,
  type CreateListingInput,
  type ListingDetailDto,
  type ListingDetailQuery,
  type ListingSummaryDto,
  type MyListingsInput,
  type Page,
  type SearchListingsInput,
  type UpdateListingInput,
} from '@cc/shared';
import { CurrentUser, RequireVerifiedEmail, type AuthUser } from '../auth/auth.decorators.js';
import { ListingsService } from './listings.service.js';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  search(@Query({ schema: searchListingsSchema }) query: SearchListingsInput): Promise<Page<ListingSummaryDto>> {
    return this.listings.search(query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Query({ schema: listingDetailQuerySchema }) query: ListingDetailQuery,
  ): Promise<ListingDetailDto> {
    const from = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : null;
    return this.listings.getDetail(user.id, id, from);
  }

  @RequireVerifiedEmail()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body({ schema: createListingSchema }) body: CreateListingInput): Promise<ListingDetailDto> {
    return this.listings.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: updateListingSchema }) body: UpdateListingInput,
  ): Promise<ListingDetailDto> {
    return this.listings.update(user.id, id, body);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<ListingDetailDto> {
    return this.listings.changeStatus(user.id, id, 'pause');
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<ListingDetailDto> {
    return this.listings.changeStatus(user.id, id, 'resume');
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<ListingDetailDto> {
    return this.listings.changeStatus(user.id, id, 'close');
  }
}

@Controller('me/listings')
export class MyListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query({ schema: myListingsSchema }) query: MyListingsInput): Promise<Page<ListingSummaryDto>> {
    return this.listings.myListings(user.id, query);
  }
}
