use chrono::NaiveDateTime;
fn main() {
    let s = "2024-05-10T12:00:00Z";
    let p = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S"));
    println!("{:?}", p);
}
