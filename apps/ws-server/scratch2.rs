use socketioxide::extract::{SocketRef, Data};
use socketioxide::SocketIo;
use serde_json::Value;

async fn on_connect(socket: SocketRef, auth: Option<Data<Value>>) {
    println!("Auth: {:?}", auth.map(|a| a.0));
}

fn main() {}
