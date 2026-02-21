use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// Default grace period if not set in environment
const DEFAULT_GRACE_PERIOD_DAYS: i64 = 30;
const OFFLINE_CACHE_DAYS: i64 = 7;
const INSTALL_FILE_NAME: &str = ".depdok-install";

/// Get grace period days from environment or use default
fn get_grace_period_days() -> i64 {
    std::env::var("TAURI_GRACE_PERIOD_DAYS")
        .ok()
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(DEFAULT_GRACE_PERIOD_DAYS)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseStatus {
    pub is_valid: bool,
    pub status: String, // "grace_period" | "licensed" | "expired" | "invalid"
    pub days_remaining: Option<u32>,
    pub customer_email: Option<String>,
    pub expires_at: Option<String>,
    pub activation_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GracePeriodInfo {
    pub is_in_grace_period: bool,
    pub days_since_installation: u32,
    pub days_remaining: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstallData {
    machine_id: String,
    first_use: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PolarValidateRequest {
    key: String,
    organization_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PolarValidateResponse {
    id: String,
    status: String,
    customer: Option<PolarCustomer>,
    expires_at: Option<String>,
    usage: i32,
    limit_usage: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PolarActivateRequest {
    key: String,
    organization_id: String,
    label: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PolarActivateResponse {
    id: String,
    license_key_id: String,
    label: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PolarDeactivateRequest {
    key: String,
    organization_id: String,
    activation_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PolarCustomer {
    email: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CachedValidation {
    status: LicenseStatus,
    cached_at: DateTime<Utc>,
}

/// Generate a unique machine fingerprint based on hardware
pub fn get_machine_fingerprint() -> Result<String, String> {
    machine_uid::get()
        .map_err(|e| format!("Failed to get machine ID: {}", e))
}

/// Get the system-level directory for storing installation data
fn get_install_data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "Failed to get HOME directory".to_string())?;
        Ok(PathBuf::from(home).join("Library/Application Support"))
    }
    
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "Failed to get APPDATA directory".to_string())?;
        Ok(PathBuf::from(appdata))
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Unsupported platform".to_string())
    }
}

/// Get or create installation date (survives app deletion)
pub fn get_or_create_install_date() -> Result<DateTime<Utc>, String> {
    let install_dir = get_install_data_dir()?;
    let install_file = install_dir.join(INSTALL_FILE_NAME);
    
    if install_file.exists() {
        // Read existing installation data
        let data = fs::read_to_string(&install_file)
            .map_err(|e| format!("Failed to read install file: {}", e))?;
        
        let install_data: InstallData = serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse install data: {}", e))?;
        
        // Verify machine ID matches (prevent copying file to another machine)
        let current_machine_id = get_machine_fingerprint()?;
        if install_data.machine_id != current_machine_id {
            // Different machine, create new install date
            create_install_file(&install_file)
        } else {
            Ok(install_data.first_use)
        }
    } else {
        // First install, create new file
        create_install_file(&install_file)
    }
}

fn create_install_file(install_file: &PathBuf) -> Result<DateTime<Utc>, String> {
    let machine_id = get_machine_fingerprint()?;
    let first_use = Utc::now();
    
    let install_data = InstallData {
        machine_id,
        first_use,
    };
    
    let data = serde_json::to_string(&install_data)
        .map_err(|e| format!("Failed to serialize install data: {}", e))?;
    
    fs::write(install_file, data)
        .map_err(|e| format!("Failed to write install file: {}", e))?;
    
    Ok(first_use)
}

/// Get days since installation
pub fn get_days_since_installation() -> Result<u32, String> {
    let install_date = get_or_create_install_date()?;
    let now = Utc::now();
    let duration = now.signed_duration_since(install_date);
    Ok(duration.num_days().max(0) as u32)
}

/// Check if within grace period
pub fn is_within_grace_period() -> Result<bool, String> {
    let days = get_days_since_installation()?;
    Ok(days < get_grace_period_days() as u32)
}

/// Get grace period info
pub fn get_grace_period_info() -> Result<GracePeriodInfo, String> {
    let days_since = get_days_since_installation()?;
    let is_in_grace = days_since < get_grace_period_days() as u32;
    let days_remaining = if is_in_grace {
        get_grace_period_days() as u32 - days_since
    } else {
        0
    };
    
    Ok(GracePeriodInfo {
        is_in_grace_period: is_in_grace,
        days_since_installation: days_since,
        days_remaining,
    })
}

/// Validate license key with Polar.sh API
pub async fn validate_license_key(key: &str, org_id: &str) -> Result<LicenseStatus, String> {
    // Development mode bypass - only if TAURI_DEV_LICENSE_KEY is explicitly set
    #[cfg(debug_assertions)]
    {
        if let Ok(dev_key) = std::env::var("TAURI_DEV_LICENSE_KEY") {
            if !dev_key.is_empty() && key == dev_key {
                return Ok(LicenseStatus {
                    is_valid: true,
                    status: "licensed".to_string(),
                    days_remaining: None,
                    customer_email: Some("dev@localhost".to_string()),
                    expires_at: None,
                    activation_id: None,
                });
            }
        }
    }
    
    let client = reqwest::Client::new();
    let url = std::env::var("TAURI_POLAR_API_URL")
        .unwrap_or_else(|_| "https://api.polar.sh/v1/customer-portal/license-keys/validate".to_string());
    
    let request_body = PolarValidateRequest {
        key: key.to_string(),
        organization_id: org_id.to_string(),
    };
    
    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to validate license: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("License validation failed: {}", response.status()));
    }
    
    let polar_response: PolarValidateResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let is_valid = polar_response.status == "granted";
    let customer_email = polar_response.customer.map(|c| c.email);
    
    
    if is_valid {
        if let Some(limit) = polar_response.limit_usage {
            if polar_response.usage >= limit {
                return Err(format!("Device limit reached. You have already activated {} device(s).", polar_response.usage));
            }
        }
    }

    let status = LicenseStatus {
        is_valid,
        status: if is_valid { "licensed".to_string() } else { "invalid".to_string() },
        days_remaining: None,
        customer_email,
        expires_at: polar_response.expires_at,
        activation_id: None, // This will be set during activation step
    };
    
    // Note: Caching is handled by the Tauri command layer
    
    Ok(status)
}

/// Get cached validation result
fn get_cached_validation(app_data_dir: &std::path::PathBuf) -> Result<Option<LicenseStatus>, String> {
    let cache_file = app_data_dir.join("license_cache.json");
    
    if !cache_file.exists() {
        return Ok(None);
    }
    
    let data = fs::read_to_string(&cache_file)
        .map_err(|e| format!("Failed to read cache: {}", e))?;
    
    let cached: CachedValidation = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse cache: {}", e))?;
    
    // Check if cache is still valid (within 7 days)
    let now = Utc::now();
    let age = now.signed_duration_since(cached.cached_at);
    
    if age.num_days() > OFFLINE_CACHE_DAYS {
        return Ok(None);
    }
    
    Ok(Some(cached.status))
}

/// Cache validation result
pub fn cache_validation_result(status: &LicenseStatus, app_data_dir: &std::path::PathBuf) -> Result<(), String> {
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    
    let cache_file = app_data_dir.join("license_cache.json");
    
    let cached = CachedValidation {
        status: status.clone(),
        cached_at: Utc::now(),
    };
    
    let data = serde_json::to_string(&cached)
        .map_err(|e| format!("Failed to serialize cache: {}", e))?;
    
    fs::write(&cache_file, data)
        .map_err(|e| format!("Failed to write cache: {}", e))?;
    
    Ok(())
}

/// Check if user is licensed (has valid license OR in grace period)
pub fn is_licensed(app_data_dir: &std::path::PathBuf) -> Result<bool, String> {
    // First check if we have a valid cached license
    if let Ok(Some(cached_status)) = get_cached_validation(app_data_dir) {
        if cached_status.is_valid {
            return Ok(true);
        }
    }
    
    // Otherwise check grace period
    is_within_grace_period()
}

/// Get current license status
pub async fn get_license_status(app_data_dir: &std::path::PathBuf) -> Result<LicenseStatus, String> {
    // Try to get cached validation first
    if let Ok(Some(cached_status)) = get_cached_validation(app_data_dir) {
        if cached_status.is_valid {
            return Ok(cached_status);
        }
    }
    
    // Check grace period
    let grace_info = get_grace_period_info()?;
    
    if grace_info.is_in_grace_period {
        return Ok(LicenseStatus {
            is_valid: true,
            status: "grace_period".to_string(),
            days_remaining: Some(grace_info.days_remaining),
            customer_email: None,
            expires_at: None,
            activation_id: None,
        });
    }
    
    // No license and grace period expired
    Ok(LicenseStatus {
        is_valid: false,
        status: "expired".to_string(),
        days_remaining: Some(0),
        customer_email: None,
        expires_at: None,
        activation_id: None,
    })
}

/// Activate license key with Polar.sh API
pub async fn activate_license_key(key: &str, org_id: &str) -> Result<String, String> {
    // Development mode bypass
    #[cfg(debug_assertions)]
    {
        if let Ok(dev_key) = std::env::var("TAURI_DEV_LICENSE_KEY") {
            if !dev_key.is_empty() && key == dev_key {
                return Ok("dev-activation-id".to_string());
            }
        }
    }

    let client = reqwest::Client::new();
    let url = std::env::var("TAURI_POLAR_API_URL_ACTIVATE")
        .unwrap_or_else(|_| "https://api.polar.sh/v1/customer-portal/license-keys/activate".to_string());
    
    // Use machine_id as label
    let machine_id = get_machine_fingerprint().unwrap_or_else(|_| "Unknown Device".to_string());

    let request_body = PolarActivateRequest {
        key: key.to_string(),
        organization_id: org_id.to_string(),
        label: machine_id,
    };
    
    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to activate license: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("License activation failed: {}", response.status()));
    }
    
    let polar_response: PolarActivateResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse activation response: {}", e))?;
    
    Ok(polar_response.id)
}

/// Deactivate license key with Polar.sh API
pub async fn deactivate_license_key(key: &str, org_id: &str, activation_id: &str) -> Result<(), String> {
    // Development mode bypass
    #[cfg(debug_assertions)]
    {
        if let Ok(dev_key) = std::env::var("TAURI_DEV_LICENSE_KEY") {
            if !dev_key.is_empty() && key == dev_key {
                return Ok(());
            }
        }
    }

    let client = reqwest::Client::new();
    let url = std::env::var("TAURI_POLAR_API_URL_DEACTIVATE")
        .unwrap_or_else(|_| "https://api.polar.sh/v1/customer-portal/license-keys/deactivate".to_string());
    
    let request_body = PolarDeactivateRequest {
        key: key.to_string(),
        organization_id: org_id.to_string(),
        activation_id: activation_id.to_string(),
    };
    
    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to deactivate license: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("License deactivation failed:{}", response.status()));
    }
    
    Ok(())
}
