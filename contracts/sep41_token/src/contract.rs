use crate::admin::{check_admin, has_administrator, read_administrator, read_state, write_administrator, write_state};
use crate::allowance::{read_allowance, spend_allowance, write_allowance};
use crate::balance::{read_balance, receive_balance, spend_balance};
use crate::metadata::{read_decimal, read_name, read_symbol, write_metadata};
use crate::storage_types::{TokenMetadata, TokenState, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};

use soroban_sdk::{contract, contractimpl, Address, Env, String};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// Initialize the token contract with metadata and initial parameters
    pub fn initialize(
        env: Env,
        admin: Address,
        decimal: u32,
        name: String,
        symbol: String,
        max_supply: Option<i128>,
        is_mintable: bool,
        is_burnable: bool,
        is_freezable: bool,
    ) {
        if has_administrator(&env) {
            panic!("already initialized");
        }

        write_administrator(&env, admin.clone());
        
        let metadata = TokenMetadata {
            decimal,
            name,
            symbol,
        };
        write_metadata(&env, metadata);

        let state = TokenState {
            admin,
            total_supply: 0,
            max_supply,
            is_mintable,
            is_burnable,
            is_freezable,
            is_frozen: false,
        };
        write_state(&env, state);
    }

    /// Mint tokens to a specified address (admin only)
    pub fn mint(env: Env, to: Address, amount: i128) {
        check_admin(&env);
        let mut state = read_state(&env);
        
        if !state.is_mintable {
            panic!("token is not mintable");
        }

        if state.is_frozen {
            panic!("token is globally frozen");
        }

        // Check max supply constraint
        if let Some(max_supply) = state.max_supply {
            if state.total_supply + amount > max_supply {
                panic!("would exceed max supply");
            }
        }

        state.total_supply += amount;
        write_state(&env, state);
        
        receive_balance(&env, to.clone(), amount);
        
        env.events().publish(
            ("mint",), 
            (to, amount)
        );
    }

    /// Burn tokens from a specified address (admin only)
    pub fn burn(env: Env, from: Address, amount: i128) {
        check_admin(&env);
        let mut state = read_state(&env);
        
        if !state.is_burnable {
            panic!("token is not burnable");
        }

        if state.is_frozen {
            panic!("token is globally frozen");
        }

        spend_balance(&env, from.clone(), amount);
        state.total_supply -= amount;
        write_state(&env, state);
        
        env.events().publish(
            ("burn",), 
            (from, amount)
        );
    }

    /// Freeze an account (admin only, requires freezable token)
    pub fn freeze(env: Env, addr: Address) {
        check_admin(&env);
        let state = read_state(&env);
        
        if !state.is_freezable {
            panic!("token is not freezable");
        }

        // Store frozen account in persistent storage
        // This is a simplified implementation - in production you'd want a more sophisticated freeze system
        env.storage().persistent().set(&addr, &true);
        
        env.events().publish(
            ("freeze",), 
            addr
        );
    }

    /// Unfreeze an account (admin only)
    pub fn unfreeze(env: Env, addr: Address) {
        check_admin(&env);
        let state = read_state(&env);
        
        if !state.is_freezable {
            panic!("token is not freezable");
        }

        env.storage().persistent().remove(&addr);
        
        env.events().publish(
            ("unfreeze",), 
            addr
        );
    }

    /// Globally freeze all token operations (admin only)
    pub fn set_frozen(env: Env, frozen: bool) {
        check_admin(&env);
        let mut state = read_state(&env);
        
        if !state.is_freezable {
            panic!("token is not freezable");
        }
        
        state.is_frozen = frozen;
        write_state(&env, state);
        
        env.events().publish(
            ("set_frozen",), 
            frozen
        );
    }

    /// Transfer admin rights to a new address (admin only)
    pub fn set_admin(env: Env, new_admin: Address) {
        check_admin(&env);
        write_administrator(&env, new_admin.clone());
        
        let mut state = read_state(&env);
        state.admin = new_admin.clone();
        write_state(&env, state);
        
        env.events().publish(
            ("set_admin",), 
            new_admin
        );
    }

    /// Get current admin address
    pub fn admin(env: Env) -> Address {
        read_administrator(&env)
    }

    /// Check if an account is frozen
    pub fn is_frozen(env: Env, addr: Address) -> bool {
        let state = read_state(&env);
        if state.is_frozen {
            return true; // Globally frozen
        }
        
        // Check if specific account is frozen
        env.storage().persistent().has(&addr)
    }

    // SEP-41 Standard Token Interface

    /// Get allowance for spender from owner
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        read_allowance(&env, from, spender).amount
    }

    /// Approve spender to spend amount from caller's account
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        write_allowance(&env, from.clone(), spender.clone(), amount, expiration_ledger);
        env.events().publish(
            ("approve",), 
            (from, spender, amount, expiration_ledger)
        );
    }

    /// Get balance of an address
    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        read_balance(&env, id)
    }

    /// Transfer tokens from caller to another address
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let state = read_state(&env);
        if state.is_frozen {
            panic!("token is globally frozen");
        }

        if Self::is_frozen(env.clone(), from.clone()) {
            panic!("from account is frozen");
        }

        if Self::is_frozen(env.clone(), to.clone()) {
            panic!("to account is frozen");
        }

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        spend_balance(&env, from.clone(), amount);
        receive_balance(&env, to.clone(), amount);
        env.events().publish(
            ("transfer",), 
            (from, to, amount)
        );
    }

    /// Transfer tokens from one address to another using allowance
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        let state = read_state(&env);
        if state.is_frozen {
            panic!("token is globally frozen");
        }

        if Self::is_frozen(env.clone(), from.clone()) {
            panic!("from account is frozen");
        }

        if Self::is_frozen(env.clone(), to.clone()) {
            panic!("to account is frozen");
        }

        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);

        spend_allowance(&env, from.clone(), spender, amount);
        spend_balance(&env, from.clone(), amount);
        receive_balance(&env, to.clone(), amount);
        env.events().publish(
            ("transfer",), 
            (from, to, amount)
        );
    }

    /// Get token decimals
    pub fn decimals(env: Env) -> u32 {
        read_decimal(&env)
    }

    /// Get token name
    pub fn name(env: Env) -> String {
        read_name(&env)
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> String {
        read_symbol(&env)
    }

    /// Get total supply
    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        read_state(&env).total_supply
    }

    /// Get max supply (if set)
    pub fn max_supply(env: Env) -> Option<i128> {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        read_state(&env).max_supply
    }

    /// Check if token is mintable
    pub fn is_mintable(env: Env) -> bool {
        read_state(&env).is_mintable
    }

    /// Check if token is burnable
    pub fn is_burnable(env: Env) -> bool {
        read_state(&env).is_burnable
    }

    /// Check if token is freezable
    pub fn is_freezable(env: Env) -> bool {
        read_state(&env).is_freezable
    }
}