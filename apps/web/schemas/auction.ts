export type AuctionDirection = 'REVERSE' | 'FORWARD';

export interface AuctionFormData {
  title: string;
  description: string;
  auctionType: AuctionDirection;
  category: string;
  itemCondition: string;
  quantity: string | number;
  quantityUnit: string;
  startingPrice: string | number;
  minimumBidStep: string | number;
  reservePrice: string | number;
  auctionStartTime: string;
  auctionEndTime: string;
  detailedInformation: string;
  location: string;
  destination: string;
  length: string | number;
  width: string | number;
  height: string | number;
  weight: string | number;
}

export type ForwardAuctionFormData = Pick<
  AuctionFormData,
  | 'title'
  | 'description'
  | 'length'
  | 'width'
  | 'height'
  | 'weight'
  | 'location'
  | 'startingPrice'
  | 'detailedInformation'
  | 'category'
> & {
  auctionEndDate: string;
};

export type MediaPreview = {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
};
