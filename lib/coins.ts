import { db } from "@/db";
import { coinTransactions } from "@/db/schema";

/**
 * 可執行 insert 的對象：頂層 db 或 db.transaction 內的 tx 皆可。
 * 取 transaction callback 的第一個參數型別即為 tx 型別；db 結構相容。
 */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 金幣異動類型，對應 schema coinTransactions.reason。 */
export type CoinReason =
  | "ask"
  | "adopt"
  | "ta_verify"
  | "levelup"
  | "checkin"
  | "purchase"
  | "heal"
  | "opening";

/**
 * 記錄一筆金幣異動（可讀流水帳）。
 * pets.coins 仍是餘額的唯一真實來源；此處只寫歷史明細供「金幣紀錄」呈現。
 * 傳入交易內的 tx 時，與金幣 update 落在同一交易，確保原子性（成敗一致）。
 */
export async function recordCoin(
  exec: Executor,
  entry: {
    userId: string;
    amount: number;
    balanceAfter: number;
    reason: CoinReason;
    description: string;
    refId?: string | null;
  },
): Promise<void> {
  await exec.insert(coinTransactions).values({
    userId: entry.userId,
    amount: entry.amount,
    balanceAfter: entry.balanceAfter,
    reason: entry.reason,
    description: entry.description,
    refId: entry.refId ?? null,
  });
}
