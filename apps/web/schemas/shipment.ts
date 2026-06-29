export interface ShipmentFormData {
  title: string;
  description: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  origin: string;
  destination: string;
  initialAmount: number;
  detailedInformation: string;
  category: string;
  timeToDeliver: string;
  pickupDate: string;
}

export interface ForwardAuctionFormData {
  title: string;
  description: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  location: string;
  startingPrice: number;
  detailedInformation: string;
  category: string;
  auctionEndDate: string;
}

export type MediaPreview = {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
};
