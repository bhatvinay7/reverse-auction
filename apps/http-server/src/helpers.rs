use garde::Error;

pub fn validate_email_helper(email: &str, _ctx: &()) -> Result<(), Error> {
    if !email.contains('@') || !email.contains('.') {
        return Err(Error::new(
            "Invalid email format according to custom helper",
        ));
    }
    Ok(())
}
