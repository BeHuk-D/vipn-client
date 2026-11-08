use anyhow::{anyhow, Result};
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use hkdf::Hkdf;
use rand::{Rng, RngCore};
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

const KEY_INFO: &[u8] = b"vipn-x25519-v1";
const CODE_ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";

fn random_code(length: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..length)
        .map(|_| CODE_ALPHABET[rng.gen_range(0..CODE_ALPHABET.len())] as char)
        .collect()
}

pub fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn token_hash(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn derive_keypair(token: &str, device_id: &str) -> (String, String) {
    let hkdf = Hkdf::<Sha256>::new(Some(device_id.as_bytes()), token.as_bytes());
    let mut okm = [0u8; 32];
    hkdf.expand(KEY_INFO, &mut okm)
        .expect("32 bytes is a valid HKDF output length");
    let secret = StaticSecret::from(okm);
    let public = PublicKey::from(&secret);
    (
        STANDARD.encode(secret.to_bytes()),
        STANDARD.encode(public.as_bytes()),
    )
}

pub fn subscription_token(secret: &str, key_id: &str) -> String {
    let hkdf = Hkdf::<Sha256>::new(Some(secret.as_bytes()), key_id.as_bytes());
    let mut okm = [0u8; 32];
    hkdf.expand(b"vipn-subscription-v1", &mut okm)
        .expect("32 bytes is a valid HKDF output length");
    URL_SAFE_NO_PAD.encode(okm)
}

pub fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| anyhow!("cannot hash password: {error}"))
}

pub fn verify_password(hash: &str, password: &str) -> Result<bool> {
    let parsed = PasswordHash::new(hash).map_err(|error| anyhow!("invalid password hash: {error}"))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

pub fn verify_dummy(password: &str) {
    static HASH: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let hash = HASH.get_or_init(|| {
        hash_password("vipn-dummy-password").expect("cannot hash dummy password")
    });
    let _ = verify_password(hash, password);
}

pub fn generate_password() -> String {
    random_code(12)
}

pub fn generate_referral_code() -> String {
    random_code(8)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_stable_and_hashed() {
        let token = new_token();
        assert_eq!(token.len(), 43);
        assert_eq!(token_hash(&token), token_hash(&token));
        assert_ne!(token_hash(&token), token_hash(&new_token()));
    }

    #[test]
    fn keypair_is_deterministic() {
        let token = new_token();
        let first = derive_keypair(&token, "device-1");
        let second = derive_keypair(&token, "device-1");
        assert_eq!(first, second);
        assert_ne!(first.1, derive_keypair(&token, "device-2").1);
    }

    #[test]
    fn password_roundtrip() {
        let hash = hash_password("correct horse").unwrap();
        assert!(verify_password(&hash, "correct horse").unwrap());
        assert!(!verify_password(&hash, "wrong").unwrap());
    }
}
