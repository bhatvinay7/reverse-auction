pub mod bid {
    tonic::include_proto!("bid");
}

use bid::bid_service_client::BidServiceClient;
use tonic::transport::Channel;

pub async fn connect(url: String) -> Result<BidServiceClient<Channel>, tonic::transport::Error> {
    BidServiceClient::connect(url).await
}
