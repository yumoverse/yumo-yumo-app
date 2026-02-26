use anchor_lang::prelude::*;

declare_id!("5EE2rSpR8f1EBnReh9FHYHTxa5ZyDoYErrwfei7M8V9w");

/// Halving formula: rate = base_rate / 2^(period)
/// Period 0 = initial rate, each period halves the conversion rate
#[program]
pub mod yumo_conversion {
    use super::*;

    /// Initialize conversion config with base rate and halving period
    pub fn initialize(ctx: Context<Initialize>, base_rate: u64, halving_period: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.base_rate = base_rate;
        config.halving_period = halving_period;
        config.current_period = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Get conversion rate for a given period (base_rate / 2^period)
    pub fn get_rate(ctx: Context<GetRate>, period: u64) -> Result<u64> {
        let config = &ctx.accounts.config;
        let rate = config.base_rate / 2u64.pow(period as u32);
        Ok(rate.max(1))
    }

    /// Advance to next halving period
    pub fn advance_period(ctx: Context<AdvancePeriod>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.current_period = config.current_period.saturating_add(1);
        Ok(())
    }

    /// Convert aYUMO to rYUMO using current period rate
    pub fn convert(ctx: Context<Convert>, ayumo_amount: u64) -> Result<u64> {
        let config = &ctx.accounts.config;
        let rate = config.base_rate / 2u64.pow(config.current_period as u32);
        let ryumo_amount = (ayumo_amount * rate) / 1_000_000; // rate in parts per million
        Ok(ryumo_amount.max(0))
    }
}

#[account]
pub struct ConversionConfig {
    pub authority: Pubkey,
    pub base_rate: u64,
    pub halving_period: u64,
    pub current_period: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ConversionConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetRate<'info> {
    pub config: Account<'info, ConversionConfig>,
}

#[derive(Accounts)]
pub struct AdvancePeriod<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, ConversionConfig>,
}

#[derive(Accounts)]
pub struct Convert<'info> {
    pub config: Account<'info, ConversionConfig>,
}
