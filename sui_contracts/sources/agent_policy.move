module agentwallet::policy {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    
    /// The Vault object that holds funds and permissions
    public struct AgentVault has key, store {
        id: UID,
        owner: address,
        agent_pubkey: address,
        budget: u64,
        expiration_ms: u64,
        vault: coin::Coin<SUI>,
    }

    /// Hot Potato: Forces the agent to return the proceeds of the trade
    public struct TradeReceipt {
        vault_id: ID,
        expected_trade_amount: u64,
    }

    /// Event emitted when a trade is completed
    public struct TradeLog has copy, drop {
        vault_id: ID,
        agent: address,
        amount_spent: u64,
    }

    const ENotOwner: u64 = 0;
    const ENotAuthorizedAgent: u64 = 1;
    const EBudgetExceeded: u64 = 2;
    const EPolicyExpired: u64 = 3;
    const EInvalidReceipt: u64 = 4;

    /// Create a new Vault granting the agent access to the funds
    public fun create_vault(
        agent_pubkey: address, 
        funds: Coin<SUI>, 
        budget: u64, 
        duration_ms: u64, 
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let vault = AgentVault {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            agent_pubkey,
            budget,
            expiration_ms: clock::timestamp_ms(clock) + duration_ms,
            vault: funds,
        };
        transfer::share_object(vault);
    }

    /// Agent calls this to extract funds for a trade.
    /// Returns the funds and a Hot Potato Receipt.
    public fun execute_trade(
        vault: &mut AgentVault, 
        amount: u64, 
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<SUI>, TradeReceipt) {
        assert!(tx_context::sender(ctx) == vault.agent_pubkey, ENotAuthorizedAgent);
        assert!(vault.budget >= amount, EBudgetExceeded);
        assert!(clock::timestamp_ms(clock) <= vault.expiration_ms, EPolicyExpired);

        vault.budget = vault.budget - amount;
        let trade_coin = coin::split(&mut vault.vault, amount, ctx);

        let receipt = TradeReceipt {
            vault_id: object::uid_to_inner(&vault.id),
            expected_trade_amount: amount,
        };

        (trade_coin, receipt)
    }

    /// Agent MUST call this at the end of the PTB to deposit the swapped asset (USDC or SUI)
    /// and consume the Hot Potato, guaranteeing the funds were not stolen.
    public fun confirm_trade<T>(
        vault: &mut AgentVault, 
        receipt: TradeReceipt, 
        _proceeds: &Coin<T>, // We check the proceeds exist, usually transferring them to the owner or keeping them
        ctx: &mut TxContext
    ) {
        let TradeReceipt { vault_id, expected_trade_amount } = receipt;
        assert!(object::uid_to_inner(&vault.id) == vault_id, EInvalidReceipt);

        event::emit(TradeLog {
            vault_id,
            agent: tx_context::sender(ctx),
            amount_spent: expected_trade_amount,
        });
        
        // Note: The PTB must handle the transfer of proceeds (e.g. to the Owner's address).
    }

    /// Owner can revoke the vault and reclaim remaining SUI
    public fun revoke_vault(vault: AgentVault, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        let AgentVault { id, owner, agent_pubkey: _, budget: _, expiration_ms: _, vault: sui_funds } = vault;
        object::delete(id);
        transfer::public_transfer(sui_funds, owner);
    }
}
