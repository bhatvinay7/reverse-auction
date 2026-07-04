use db;
fn main() {
    println!("Testing DB...");
    let pool = db::get_connection_pool();
    let _conn = pool.get().unwrap();
    println!("DB connected!");
}
