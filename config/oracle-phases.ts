/**
 * Oracle plan faz anahtarları — sen yönetirsin.
 * Her faz env ile açılıp kapatılır. Varsayılan kapalı (false).
 *
 * Örnek: Faz 2'yi açmak için .env.local'e ekle:
 *   ORACLE_FAZ2_ENABLED=true
 *
 * Tüm fazlar:
 *   ORACLE_FAZ2_ENABLED           — Fiş kaydedilince post-process kuyruğa alınır, worker çalışır.
 *   ORACLE_TRUST_WORKER_ENABLED   — Faz2 bitince trust-update çağrılır (user_trust_scores, history).
 *   ORACLE_ACCOUNT_SEASON_LEVEL_ENABLED — Trust-update sonrası XP yazılır, account/season level güncellenir.
 *   ORACLE_RETRY_CRON_ENABLED     — Retry-failed-postprocess cron'u anlamlı (yoksa cron çağrılmaz).
 */

function envBool(name: string): boolean {
  const v = process.env[name];
  return v === "true" || v === "1";
}

function envIsUnset(name: string): boolean {
  return process.env[name] == null || process.env[name] === "";
}

export const oraclePhases = {
  /** Faz2: post-process worker (receipt_vision_raw → verified, trust-update tetiklemesi). */
  get faz2Enabled(): boolean {
    if (process.env.NODE_ENV === "development" && envIsUnset("ORACLE_FAZ2_ENABLED")) {
      return true;
    }
    return envBool("ORACLE_FAZ2_ENABLED");
  },

  /** Trust worker: Faz2 sonrası user_trust_scores + user_trust_score_history güncellemesi. */
  get trustWorkerEnabled(): boolean {
    return envBool("ORACLE_TRUST_WORKER_ENABLED");
  },

  /** Account + Season level: XP event'leri, user_profiles.account_xp/level, season_xp/level. */
  get accountSeasonLevelEnabled(): boolean {
    return envBool("ORACLE_ACCOUNT_SEASON_LEVEL_ENABLED");
  },

  /** Retry cron: failed post-process'leri yeniden kuyruğa al. */
  get retryCronEnabled(): boolean {
    return envBool("ORACLE_RETRY_CRON_ENABLED");
  },
};

export function isFaz2Enabled(): boolean {
  return oraclePhases.faz2Enabled;
}

export function isTrustWorkerEnabled(): boolean {
  return oraclePhases.trustWorkerEnabled;
}

export function isAccountSeasonLevelEnabled(): boolean {
  return oraclePhases.accountSeasonLevelEnabled;
}
