use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("2Px7MzCoN35kaj6jVhGw7r23RYWFEynkhwhxSFN5JDQX");

#[program]
pub mod yumo_staking {
    use super::*;

    /// Initialize staking pool for rYUMO
    pub fn initialize_ryumo_stake(ctx: Context<InitializeStake>, reward_rate: u64) -> Result<()> {
        msg!("rYUMO staking initialized, reward_rate: {}", reward_rate);
        Ok(())
    }

    /// Initialize staking pool for YUMO
    pub fn initialize_yumo_stake(ctx: Context<InitializeStake>, reward_rate: u64) -> Result<()> {
        msg!("YUMO staking initialized, reward_rate: {}", reward_rate);
        Ok(())
    }

    /// Stake rYUMO tokens
    pub fn stake_ryumo(ctx: Context<Stake>, amount: u64) -> Result<()> {
        msg!("Staked {} rYUMO", amount);
        Ok(())
    }

    /// Stake YUMO tokens
    pub fn stake_yumo(ctx: Context<Stake>, amount: u64) -> Result<()> {
        msg!("Staked {} YUMO", amount);
        Ok(())
    }

    /// Unstake and claim rewards
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        msg!("Unstaked {} with rewards", amount);
        Ok(())
    }

    /// Claim staking rewards without unstaking
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        msg!("Rewards claimed");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeStake<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub pool: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub reward_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_reward_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
