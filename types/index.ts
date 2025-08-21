export interface Message {
  message: string;
}

export interface Context {
  // コョブの実行に関する情報
  id: string;
  timestamp: Date;
  attempt: number;

  // 環境情報
  environment: {
    id: string;
    name: string;
    type: "DEVELOPMENT" | "PRODUCTION" | "STAGING";
  };

  // 実行元の情報
  source?: {
    id: string;
    type: string;
  };

  // スケジュール実行の場合の情報
  scheduled?: {
    scheduledAt: Date;
    attempt: number;
  };
}
