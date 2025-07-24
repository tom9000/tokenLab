#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, symbol_short};

#[cfg(test)]
mod test;

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// Initialize the token contract
    pub fn initialize(
        env: Env,
        admin: Address,
        decimal: u32,
        name: String,
        symbol: String,
    ) {
        env.storage().instance().set(&symbol_short!("ADMIN"), &admin);
        env.storage().instance().set(&symbol_short!("NAME"), &name);
        env.storage().instance().set(&symbol_short!("SYMBOL"), &symbol);
        env.storage().instance().set(&symbol_short!("DECIMAL"), &decimal);
        env.storage().instance().set(&symbol_short!("SUPPLY"), &0i128);
    }

    /// Get token name
    pub fn name(env: Env) -> String {
        env.storage().instance().get(&symbol_short!("NAME")).unwrap_or(String::from_str(&env, ""))
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&symbol_short!("SYMBOL")).unwrap_or(String::from_str(&env, ""))
    }

    /// Get token decimals
    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&symbol_short!("DECIMAL")).unwrap_or(0)
    }

    /// Get total supply
    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&symbol_short!("SUPPLY")).unwrap_or(0)
    }

    /// Get balance of an address
    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&id).unwrap_or(0)
    }

    /// Mint tokens (admin only)
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&symbol_short!("ADMIN")).unwrap();
        admin.require_auth();

        let balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);
        env.storage().persistent().set(&to, &(balance + amount));

        let supply: i128 = env.storage().instance().get(&symbol_short!("SUPPLY")).unwrap_or(0);
        env.storage().instance().set(&symbol_short!("SUPPLY"), &(supply + amount));
    }

    /// Transfer tokens
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_balance: i128 = env.storage().persistent().get(&from).unwrap_or(0);
        let to_balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);

        if from_balance < amount {
            panic!("insufficient balance");
        }

        env.storage().persistent().set(&from, &(from_balance - amount));
        env.storage().persistent().set(&to, &(to_balance + amount));
    }
}