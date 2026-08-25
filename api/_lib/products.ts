/* ==========================================================================
   Server-side product catalogue — the single source of truth for prices.

   The client sends a productId only; prices are decided here so a tampered
   request cannot buy a 500-Star item for 1 Star. Keep these in lockstep with
   DONATION_COSMETICS in src/game/config.ts.
   ========================================================================== */

export interface ServerProduct {
  id: string
  name: string
  desc: string
  /** Telegram Stars (XTR) amount. */
  priceStars: number
  /** Display price in USD. */
  priceUsd: number
  /** USDC base units (6 decimals) expected on Base. */
  usdcUnits: bigint
}

function usdc(priceUsd: number): bigint {
  return BigInt(Math.round(priceUsd * 1_000_000))
}

function make(
  id: string,
  name: string,
  priceStars: number,
  priceUsd: number,
): ServerProduct {
  return {
    id,
    name,
    desc: `${name}. Cosmetic only — no gameplay power.`,
    priceStars,
    priceUsd,
    usdcUnits: usdc(priceUsd),
  }
}

export const PRODUCTS: Record<string, ServerProduct> = {
  cos_outfit_founder_hoodie: make('cos_outfit_founder_hoodie', 'Founder Hoodie', 149, 2.99),
  cos_desk_carbon: make('cos_desk_carbon', 'Carbon Desk', 199, 3.99),
  cos_monitor_ultrawide: make('cos_monitor_ultrawide', 'Ultrawide Monitor', 249, 4.99),
  cos_tool_founder_mug: make('cos_tool_founder_mug', 'Founder Mug', 99, 1.99),
  cos_room_city_loft: make('cos_room_city_loft', 'City Loft Skin', 349, 6.99),
  cos_room_neon_quant: make('cos_room_neon_quant', 'Neon Quant Sign', 499, 9.99),
}

export function getProduct(id: unknown): ServerProduct | null {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PRODUCTS, id)
    ? PRODUCTS[id]!
    : null
}
