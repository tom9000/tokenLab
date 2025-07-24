use crate::storage_types::{DataKey, TokenState, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};
use soroban_sdk::{Address, Env};

pub fn has_administrator(e: &Env) -> bool {
    let key = DataKey::Admin;
    e.storage().instance().has(&key)
}

pub fn read_administrator(e: &Env) -> Address {
    let key = DataKey::Admin;
    e.storage().instance().get(&key).unwrap()
}

pub fn write_administrator(e: &Env, id: Address) {
    let key = DataKey::Admin;
    e.storage().instance().set(&key, &id);
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn read_state(e: &Env) -> TokenState {
    let key = DataKey::State;
    e.storage().instance().get(&key).unwrap()
}

pub fn write_state(e: &Env, state: TokenState) {
    let key = DataKey::State;
    e.storage().instance().set(&key, &state);
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn check_admin(e: &Env) {
    let admin = read_administrator(e);
    admin.require_auth();
}