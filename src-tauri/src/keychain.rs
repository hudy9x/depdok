use keyring::Entry;

const SERVICE_NAME: &str = "com.depdok.app";
const ACCOUNT_NAME: &str = "license_key";

/// Save license key to system keychain
pub fn save_license_key(key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
    
    entry
        .set_password(key)
        .map_err(|e| format!("Failed to save license key: {}", e))?;
    
    Ok(())
}

/// Get license key from system keychain
pub fn get_license_key() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
    
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get license key: {}", e)),
    }
}

/// Delete license key from system keychain
pub fn delete_license_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
    
    match entry.delete_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(format!("Failed to delete license key: {}", e)),
    }
}
