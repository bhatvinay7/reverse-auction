use redis::RedisError;
fn check(e: &RedisError) -> bool { e.is_timeout() }
