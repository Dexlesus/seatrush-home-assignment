/** Response types. They mirror the API's DTOs (see /docs). */

export interface Fan {
  handle: string;
  displayName: string;
}

export interface EventSummary {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  dropAt: string;
  saleOpen: boolean;
}

export interface EventList {
  serverNow: string;
  events: EventSummary[];
}

export interface Zone {
  name: string;
  fromRow: string;
  toRow: string;
  priceAgorot: number;
}

export interface EventDetails extends EventSummary {
  serverNow: string;
  rowCount: number;
  seatsPerRow: number;
  zones: Zone[];
}

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOLD';

export interface Seat {
  label: string;
  row: string;
  seatNumber: number;
  zone: string;
  priceAgorot: number;
  status: SeatStatus;
}

export interface SeatMap {
  eventId: string;
  serverNow: string;
  seats: Seat[];
}

export interface HeldSeat {
  label: string;
  zone: string;
  priceAgorot: number;
}

export interface Hold {
  holdId: string;
  eventId: string;
  status: string;
  seats: HeldSeat[];
  totalAgorot: number;
  createdAt: string;
  expiresAt: string;
  serverNow: string;
}

export interface MyHolds {
  serverNow: string;
  holds: Hold[];
}

export interface Order {
  orderId: string;
  holdId: string;
  eventId: string;
  eventName: string;
  venue: string;
  startsAt: string;
  seats: HeldSeat[];
  /** Sum of the seat prices. */
  subtotalAgorot: number;
  promoCode: string | null;
  discountAgorot: number;
  /** What the fan paid: subtotal − discount. */
  totalAgorot: number;
  createdAt: string;
}

export interface CreateEventBody {
  name: string;
  venue: string;
  startsAt: string;
  dropAt: string;
  rowCount: number;
  seatsPerRow: number;
  zones: Zone[];
}

export interface HoldBody {
  seats?: string[];
  bestAvailable?: { count: number; maxPriceAgorot?: number; zone?: string };
}
