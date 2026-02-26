/**
 * Country list with currency information
 * Sorted alphabetically by country name
 */

export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  currency: string; // ISO 4217
  symbol: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "AE", name: "United Arab Emirates", currency: "AED", symbol: "د.إ" },
  { code: "AR", name: "Argentina", currency: "ARS", symbol: "$" },
  { code: "AU", name: "Australia", currency: "AUD", symbol: "A$" },
  { code: "AT", name: "Austria", currency: "EUR", symbol: "€" },
  { code: "BE", name: "Belgium", currency: "EUR", symbol: "€" },
  { code: "BR", name: "Brazil", currency: "BRL", symbol: "R$" },
  { code: "CA", name: "Canada", currency: "CAD", symbol: "C$" },
  { code: "CL", name: "Chile", currency: "CLP", symbol: "$" },
  { code: "CN", name: "China", currency: "CNY", symbol: "¥" },
  { code: "CZ", name: "Czech Republic", currency: "CZK", symbol: "Kč" },
  { code: "DK", name: "Denmark", currency: "DKK", symbol: "kr" },
  { code: "EG", name: "Egypt", currency: "EGP", symbol: "£" },
  { code: "FI", name: "Finland", currency: "EUR", symbol: "€" },
  { code: "FR", name: "France", currency: "EUR", symbol: "€" },
  { code: "DE", name: "Germany", currency: "EUR", symbol: "€" },
  { code: "GR", name: "Greece", currency: "EUR", symbol: "€" },
  { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "£" },
  { code: "HU", name: "Hungary", currency: "HUF", symbol: "Ft" },
  { code: "IN", name: "India", currency: "INR", symbol: "₹" },
  { code: "ID", name: "Indonesia", currency: "IDR", symbol: "Rp" },
  { code: "IE", name: "Ireland", currency: "EUR", symbol: "€" },
  { code: "IL", name: "Israel", currency: "ILS", symbol: "₪" },
  { code: "IT", name: "Italy", currency: "EUR", symbol: "€" },
  { code: "JP", name: "Japan", currency: "JPY", symbol: "¥" },
  { code: "KR", name: "South Korea", currency: "KRW", symbol: "₩" },
  { code: "MY", name: "Malaysia", currency: "MYR", symbol: "RM" },
  { code: "MX", name: "Mexico", currency: "MXN", symbol: "$" },
  { code: "NL", name: "Netherlands", currency: "EUR", symbol: "€" },
  { code: "NZ", name: "New Zealand", currency: "NZD", symbol: "NZ$" },
  { code: "NO", name: "Norway", currency: "NOK", symbol: "kr" },
  { code: "PH", name: "Philippines", currency: "PHP", symbol: "₱" },
  { code: "PL", name: "Poland", currency: "PLN", symbol: "zł" },
  { code: "PT", name: "Portugal", currency: "EUR", symbol: "€" },
  { code: "RO", name: "Romania", currency: "RON", symbol: "lei" },
  { code: "RU", name: "Russia", currency: "RUB", symbol: "₽" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", symbol: "﷼" },
  { code: "SG", name: "Singapore", currency: "SGD", symbol: "S$" },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R" },
  { code: "ES", name: "Spain", currency: "EUR", symbol: "€" },
  { code: "SE", name: "Sweden", currency: "SEK", symbol: "kr" },
  { code: "CH", name: "Switzerland", currency: "CHF", symbol: "CHF" },
  { code: "TH", name: "Thailand", currency: "THB", symbol: "฿" },
  { code: "TR", name: "Turkey", currency: "TRY", symbol: "₺" },
  { code: "US", name: "United States", currency: "USD", symbol: "$" },
  { code: "VN", name: "Vietnam", currency: "VND", symbol: "₫" },
];

/**
 * Get country by code
 */
export function getCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Get countries sorted alphabetically by name
 */
export function getCountriesSorted(): CountryInfo[] {
  return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
}





