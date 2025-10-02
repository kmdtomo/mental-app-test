export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripeが設定されていない場合はwebhookをスキップ
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY_LIVE) {
    console.log("Stripe webhook skipped - no configuration");
    return new Response(JSON.stringify({ message: "Stripe not configured" }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Stripeが設定されている場合のみ処理を実行
  // 本番環境では以下のコメントを外して使用してください
  /*
  const { stripe } = await import("@/lib/stripe/config");
  const {
    deletePriceRecord,
    deleteProductRecord,
    manageSubscriptionStatusChange,
    upsertPriceRecord,
    upsertProductRecord,
  } = await import("@/lib/supabase/admin");
  
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // ... 既存のwebhook処理ロジック ...
  */
  
  return new Response(JSON.stringify({ message: "Webhook endpoint placeholder" }), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}