use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("FiYhkXSB5gSsvL8cXcUELd4Yo9Z1ezU81r5GmophjvSy");

#[program]
pub mod yumo_tokens {
    use super::*;

    /// Initialize token mints for aYUMO, rYUMO, YUMO
    pub fn initialize_mints(ctx: Context<InitializeMints>) -> Result<()> {
        msg!("YUMO tokens initialized");
        Ok(())
    }

    /// Claim aYUMO tokens (receipt-based rewards)
    pub fn claim_ayumo(ctx: Context<ClaimAyumo>, amount: u64) -> Result<()> {
        msg!("Claimed {} aYUMO", amount);
        Ok(())
    }

    /// Claim rYUMO tokens (from aYUMO conversion or staking rewards)
    pub fn claim_ryumo(ctx: Context<ClaimRyumo>, amount: u64) -> Result<()> {
        msg!("Claimed {} rYUMO", amount);
        Ok(())
    }

    /// Claim YUMO tokens (main token)
    pub fn claim_yumo(ctx: Context<ClaimYumo>, amount: u64) -> Result<()> {
        msg!("Claimed {} YUMO", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMints<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimAyumo<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub ayumo_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRyumo<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub ryumo_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimYumo<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub yumo_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
