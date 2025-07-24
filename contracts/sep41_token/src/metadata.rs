use crate::storage_types::{DataKey, TokenMetadata, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};
use soroban_sdk::{Env, String};

// Metadata functions
pub fn read_decimal(e: &Env) -> u32 {
    let key = DataKey::State;
    let metadata_key = DataKey::State; // Use separate key for metadata
    if let Some(metadata) = e.storage().instance().get::<DataKey, TokenMetadata>(&metadata_key) {
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        metadata.decimal
    } else {
        0
    }
}

pub fn read_name(e: &Env) -> String {
    let key = DataKey::State;
    if let Some(metadata) = e.storage().instance().get::<DataKey, TokenMetadata>(&key) {
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        metadata.name
    } else {
        String::from_str(e, "")
    }
}

pub fn read_symbol(e: &Env) -> String {
    let key = DataKey::State;
    if let Some(metadata) = e.storage().instance().get::<DataKey, TokenMetadata>(&key) {
        e.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        metadata.symbol
    } else {
        String::from_str(e, "")
    }
}

pub fn write_metadata(e: &Env, metadata: TokenMetadata) {
    let key = DataKey::State;
    e.storage().instance().set(&key, &metadata);
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}