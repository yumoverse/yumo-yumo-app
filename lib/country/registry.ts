/**
 * Country configuration registry
 * Provides access to country configs and country detection
 */

import type { CountryConfig } from "./base";
import { TR_CONFIG } from "./TR.config";
import { TH_CONFIG } from "./TH.config";
import { ID_CONFIG } from "./ID.config";
import { TW_CONFIG } from "./TW.config";
import { AE_CONFIG } from "./AE.config";
import { IN_CONFIG } from "./IN.config";
import { US_CONFIG } from "./US.config";
import { CA_CONFIG } from "./CA.config";
import { MX_CONFIG } from "./MX.config";
import { BR_CONFIG } from "./BR.config";
import { PH_CONFIG } from "./PH.config";
import { VN_CONFIG } from "./VN.config";
import { SG_CONFIG } from "./SG.config";
import { MY_CONFIG } from "./MY.config";
import { ZA_CONFIG } from "./ZA.config";
import { NG_CONFIG } from "./NG.config";
import { RU_CONFIG } from "./RU.config";
import { UA_CONFIG } from "./UA.config";
import { KZ_CONFIG } from "./KZ.config";
import { CN_CONFIG } from "./CN.config";
import { GENERIC_CONFIG } from "./GENERIC.config";

const countryConfigs: Record<"TR" | "TH" | "ID" | "TW" | "AE" | "IN" | "US" | "CA" | "MX" | "BR" | "PH" | "VN" | "SG" | "MY" | "ZA" | "NG" | "RU" | "UA" | "KZ" | "CN" | "GENERIC", CountryConfig> = {
  TR: TR_CONFIG,
  TH: TH_CONFIG,
  ID: ID_CONFIG,
  TW: TW_CONFIG,
  AE: AE_CONFIG,
  IN: IN_CONFIG,
  US: US_CONFIG,
  CA: CA_CONFIG,
  MX: MX_CONFIG,
  BR: BR_CONFIG,
  PH: PH_CONFIG,
  VN: VN_CONFIG,
  SG: SG_CONFIG,
  MY: MY_CONFIG,
  ZA: ZA_CONFIG,
  NG: NG_CONFIG,
  RU: RU_CONFIG,
  UA: UA_CONFIG,
  KZ: KZ_CONFIG,
  CN: CN_CONFIG,
  GENERIC: GENERIC_CONFIG,
};

/**
 * Get country configuration by country code
 * @throws Error if country code is not supported
 */
export function getCountryConfig(code: "TR" | "TH" | "ID" | "TW" | "AE" | "IN" | "US" | "CA" | "MX" | "BR" | "PH" | "VN" | "SG" | "MY" | "ZA" | "NG" | "RU" | "UA" | "KZ" | "CN" | "GENERIC"): CountryConfig {
  const config = countryConfigs[code];
  if (!config) {
    throw new Error(`Unsupported country: ${code}. Only TR, TH, ID, TW, AE, IN, US, CA, MX, BR, PH, VN, SG, MY, ZA, NG, RU, UA, KZ, CN, and GENERIC are supported.`);
  }
  return config;
}

/**
 * Detect country from OCR text by checking all country configs
 * Returns the first matching country or GENERIC as fallback
 * IMPORTANT: Detection order matters - TR → TH → ID → TW → AE → IN → US → CA → MX → BR → PH → VN → SG → MY → ZA → NG → RU → UA → KZ → CN → GENERIC
 */
export function detectCountryFromText(text: string): "TR" | "TH" | "ID" | "TW" | "AE" | "IN" | "US" | "CA" | "MX" | "BR" | "PH" | "VN" | "SG" | "MY" | "ZA" | "NG" | "RU" | "UA" | "KZ" | "CN" | "GENERIC" {
  const lowerText = text.toLowerCase();

  // Check TR config
  const trConfig = TR_CONFIG;
  for (const pattern of trConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "TR";
    }
  }

  // Check TH config
  const thConfig = TH_CONFIG;
  for (const pattern of thConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "TH";
    }
  }

  // Check ID config
  const idConfig = ID_CONFIG;
  for (const pattern of idConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "ID";
    }
  }

  // Check TW config
  const twConfig = TW_CONFIG;
  for (const pattern of twConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "TW";
    }
  }

  // Check AE config
  const aeConfig = AE_CONFIG;
  for (const pattern of aeConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "AE";
    }
  }

  // Check IN config
  const inConfig = IN_CONFIG;
  for (const pattern of inConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "IN";
    }
  }

  // Check US config
  const usConfig = US_CONFIG;
  for (const pattern of usConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "US";
    }
  }

  // Check CA config
  const caConfig = CA_CONFIG;
  for (const pattern of caConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "CA";
    }
  }

  // Check MX config
  const mxConfig = MX_CONFIG;
  for (const pattern of mxConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "MX";
    }
  }

  // Check BR config
  const brConfig = BR_CONFIG;
  for (const pattern of brConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "BR";
    }
  }

  // Check PH config
  const phConfig = PH_CONFIG;
  for (const pattern of phConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "PH";
    }
  }

  // Check VN config
  const vnConfig = VN_CONFIG;
  for (const pattern of vnConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "VN";
    }
  }

  // Check SG config
  const sgConfig = SG_CONFIG;
  for (const pattern of sgConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "SG";
    }
  }

  // Check MY config
  const myConfig = MY_CONFIG;
  for (const pattern of myConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "MY";
    }
  }

  // Check ZA config
  const zaConfig = ZA_CONFIG;
  for (const pattern of zaConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "ZA";
    }
  }

  // Check NG config
  const ngConfig = NG_CONFIG;
  for (const pattern of ngConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "NG";
    }
  }

  // Check RU config
  const ruConfig = RU_CONFIG;
  for (const pattern of ruConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "RU";
    }
  }

  // Check UA config
  const uaConfig = UA_CONFIG;
  for (const pattern of uaConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "UA";
    }
  }

  // Check KZ config
  const kzConfig = KZ_CONFIG;
  for (const pattern of kzConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "KZ";
    }
  }

  // Check CN config
  const cnConfig = CN_CONFIG;
  for (const pattern of cnConfig.detection.countryIndicators) {
    if (pattern.test(lowerText)) {
      return "CN";
    }
  }

  // Fallback to GENERIC if no specific country detected
  return "GENERIC";
}
