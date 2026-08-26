export interface Auction {
  id: string;
  title: string;
  description: string;
  auction_type: 'REVERSE' | 'FORWARD';
  minimum_bid_step: number;
  reserve_price?: number | null;
  item_category?: string | null;
  item_condition?: string | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  pickup_terms?: string | null;
  origin_address?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  dest_address?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  auction_start_time: string;
  auction_end_time: string;
  pickup_date?: string | null;
  media_urls?: string[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  starting_price?: number;
  participants_count?: number;
  is_registered?: boolean;
  is_closed?: boolean;
  winner_id?: string;
}

export type ListingStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED' | 'SCHEDULED' | 'CANCELLED';

export interface AuctionListing {
  id: string;
  seller_id: string;
  auction_id?: string | null;
  status: ListingStatus;
  auction_type: 'REVERSE' | 'FORWARD';
  title: string;
  description: string;
  item_category?: string | null;
  item_condition?: string | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  starting_price: number;
  minimum_bid_step: number;
  reserve_price?: number | null;
  origin_address?: string | null;
  pickup_terms?: string | null;
  availability_start?: string | null;
  availability_end?: string | null;
  media_urls: (string | null)[];
  admin_feedback?: string | null;
  submitted_at: string;
  updated_at: string;
  seller_name?: string;
  seller_email?: string;
  seller_company?: string | null;
}

export interface ListingHistoryEvent {
  id: string;
  from_status?: string | null;
  to_status: string;
  actor_id?: string | null;
  note?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'alert' | 'success' | 'info' | 'system';
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

export interface Bid {
  time: string;
  amount: number;
  bidder: string;
}

export interface AuctionQnAItem {
  id: string;
  vendor: string;
  text: string;
  time: string;
  answers: {
    vendor: string;
    text: string;
    time: string;
  }[];
}

export interface Media {
  url: string;
  type: 'IMAGE' | 'VIDEO';
}

export interface SocketNewBidPayload {
  id: string;
  amount: number;
  vendor: string;
  rating: number;
  isCurrentUser: boolean;
  timestamp: string;
}
