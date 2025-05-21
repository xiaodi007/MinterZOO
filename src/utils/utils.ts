import { SuiClient } from "@mysten/sui/client";
import { CoinStruct, PaginatedCoins } from "@mysten/sui/client"; 

/**
 * 获取某个用户地址下，指定 coinType 的所有 coin 对象
 */
export async function fetchAllCoinsByType(
  client: SuiClient,
  address: string,
  coinType: string
): Promise<CoinStruct[]> {
  const allCoins: CoinStruct[] = [];
  let nextCursor: string | null | undefined = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const { data, nextCursor: cursor, hasNextPage: hasMore }: PaginatedCoins =
      await client.getCoins({
        owner: address,
        coinType,
        limit: 50, // 可根据实际情况调节分页大小
        cursor: nextCursor || undefined,
      });

    allCoins.push(...data);
    nextCursor = cursor;
    hasNextPage = hasMore;
  }

  return allCoins;
}

export function getTotalBalanceBigInt(coins: CoinStruct[]): bigint {
  return coins.reduce((acc, coin) => acc + BigInt(coin.balance), BigInt(0));
}

export function formatAmount(amount: bigint, decimals: number, precision = 4): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, precision);
  return `${whole.toString()}.${fractionStr}`;
}