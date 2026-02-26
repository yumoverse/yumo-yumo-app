// Run: cargo run -p gen-keypairs (from yumo-contracts/)
// Generates keypair JSON files for anchor build - no Solana CLI required
use ed25519_dalek::{PublicKey, SecretKey};
use serde_json::to_string;
use std::fs;
use std::path::Path;

fn main() {
    let names = ["yumo_tokens", "yumo_conversion", "yumo_staking"];
    let deploy_dir = Path::new("target/deploy");
    fs::create_dir_all(deploy_dir).expect("create target/deploy");

    for (i, name) in names.iter().enumerate() {
        let mut seed = [0u8; 32];
        let len = name.len().min(31);
        seed[0..len].copy_from_slice(&name.as_bytes()[..len]);
        seed[31] = i as u8;

        let secret_key = SecretKey::from_bytes(&seed).expect("valid secret key");
        let public_key = PublicKey::from(&secret_key);
        let mut keypair_bytes = [0u8; 64];
        keypair_bytes[0..32].copy_from_slice(&seed);
        keypair_bytes[32..64].copy_from_slice(public_key.as_bytes());

        let keypair_name = name.replace('_', "-");
        let path = deploy_dir.join(format!("{}-keypair.json", keypair_name));
        let json = to_string::<Vec<u8>>(&keypair_bytes.to_vec()).expect("serialize");
        fs::write(&path, json).expect("write keypair");
        let pubkey = bs58::encode(public_key.as_bytes()).into_string();
        println!("Wrote {} (pubkey: {})", path.display(), pubkey);
    }
}
