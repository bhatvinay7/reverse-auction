use socketioxide::extract::{SocketRef, Data};
use serde_json::Value;

pub fn check_fn(socket: SocketRef, auth: Data<Value>) {}
