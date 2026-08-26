fn main() {
    let dt = "2026-07-03T12:30:00Z".parse::<chrono::DateTime<chrono::Utc>>();
    println!("{:?}", dt);
}
