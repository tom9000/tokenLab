#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_token_basic_functionality() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Mock all auth to make testing easier
    env.mock_all_auths();

    // Initialize token
    client.initialize(
        &admin,
        &7u32,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
    );

    // Test metadata
    assert_eq!(client.name(), String::from_str(&env, "Test Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "TEST"));
    assert_eq!(client.decimals(), 7u32);
    assert_eq!(client.total_supply(), 0i128);

    // Test balances
    assert_eq!(client.balance(&user1), 0i128);
    assert_eq!(client.balance(&user2), 0i128);

    // Test minting
    client.mint(&user1, &1000i128);
    assert_eq!(client.balance(&user1), 1000i128);
    assert_eq!(client.total_supply(), 1000i128);

    // Test transfer
    client.transfer(&user1, &user2, &300i128);
    assert_eq!(client.balance(&user1), 700i128);
    assert_eq!(client.balance(&user2), 300i128);
    assert_eq!(client.total_supply(), 1000i128); // Supply unchanged
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_insufficient_balance_transfer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    client.initialize(
        &admin,
        &7u32,
        &String::from_str(&env, "Test Token"),
        &String::from_str(&env, "TEST"),
    );

    // Try to transfer more than balance (should panic)
    client.transfer(&user1, &user2, &100i128);
}