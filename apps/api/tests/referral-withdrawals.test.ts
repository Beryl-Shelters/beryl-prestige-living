import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  buyer1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  buyer2: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  referrer: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  empty: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  seller: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  admin: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  listing: "10000000-0000-4000-8000-000000000001",
  purchase1: "20000000-0000-4000-8000-000000000001",
  purchase2: "20000000-0000-4000-8000-000000000002",
};
const baseMigrations = [
  "202609060001_customer_auth_foundation.sql",
  "202609080001_customer_listings.sql",
  "202609100001_short_display_codes.sql",
  "202609130001_customer_referrals.sql",
  "202609140001_customer_settings_profile.sql",
  "202609270002_customer_completed_purchases.sql",
  "202609270003_admin_invitations.sql",
  "202609280003_referral_commission_foundation.sql",
  "202609280004_admin_referral_payouts.sql",
];
async function migration(db: PGlite, name: string) {
  await db.exec(
    await readFile(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    ),
  );
}
async function fixture(t: TestContext, withdrawals = true) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    "create schema auth;create function auth.uid() returns uuid language sql stable as 'select null::uuid';create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');create role anon;create role authenticated;create role service_role bypassrls;",
  );
  for (const [key, id] of Object.entries(ids).filter(
    ([key]) => !["listing", "purchase1", "purchase2"].includes(key),
  ))
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
      [id, `${key}@example.test`],
    );
  for (const name of baseMigrations) await migration(db, name);
  const profile =
    "insert into customer_profiles(id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at,bank_account_name,bank_name,bank_account_number) values($1,$2,'Test',$3,'+234',$4,$5,'INVESTOR','PERSONAL',now(),$6,$7,$8)";
  let phone = 8011111111;
  for (const [id, name, bank] of [
    [ids.buyer1, "Buyer One", false],
    [ids.buyer2, "Buyer Two", false],
    [ids.referrer, "Referrer", true],
    [ids.empty, "Empty", false],
    [ids.seller, "Seller", false],
  ] as const) {
    phone++;
    await db.query(profile, [
      id,
      name,
      `${name.replace(" ", "").toLowerCase()}@example.test`,
      String(phone),
      `+234${phone}`,
      bank ? "Referrer Test" : null,
      bank ? "Test Bank" : null,
      bank ? "0123456789" : null,
    ]);
  }
  await db.query(
    "insert into admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,active,accepted_at) values($1,'Finance Admin','admin@example.test','+2348055555555','MANAGEMENT','ADMIN',true,now())",
    [ids.admin],
  );
  await db.query(
    "insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status) values($1,$2,'RES-ABC234','Controlled','Controlled','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',5000000,500000,'Address','Lagos','Ikeja','LISTED')",
    [ids.listing, ids.seller],
  );
  await db.query(
    "insert into customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code,created_at) values($1,'REF-ABC234','PROPERTY',$2,'RES-ABC234','2026-09-01')",
    [ids.referrer, ids.listing],
  );
  await db.query(
    "select record_admin_completed_purchase($1,$2,$3,'RES-ABC234',5000000,'2026-09-20','REF-ABC234')",
    [ids.purchase1, ids.admin, ids.buyer1],
  );
  await db.query(
    "select record_admin_completed_purchase($1,$2,$3,'RES-ABC234',2500000,'2026-09-21','REF-ABC234')",
    [ids.purchase2, ids.admin, ids.buyer2],
  );
  if (withdrawals)
    await migration(db, "202609290001_customer_referral_withdrawals.sql");
  return db;
}
type Balance = {
  totalEarnedMinor: number;
  totalPaidMinor: number;
  grossOutstandingMinor: number;
  pendingMinor: number;
  availableMinor: number;
  minimumMinor: number;
};
async function balance(db: PGlite, owner = ids.referrer) {
  return (
    await db.query<{ value: { balance: Balance } }>(
      "select list_customer_referral_withdrawals($1,10000,1,10) value",
      [owner],
    )
  ).rows[0]!.value.balance;
}

test("withdrawals reserve exact commission and become paid only with receipt-backed Admin recording", async (t) => {
  const db = await fixture(t),
    request1 = "30000000-0000-4000-8000-000000000001",
    cancelled = "30000000-0000-4000-8000-000000000002",
    paidRequest = "30000000-0000-4000-8000-000000000003",
    directPayment = "40000000-0000-4000-8000-000000000001",
    withdrawalPayment = "40000000-0000-4000-8000-000000000002";
  assert.deepEqual(await balance(db, ids.empty), {
    totalEarnedMinor: 0,
    totalPaidMinor: 0,
    grossOutstandingMinor: 0,
    pendingMinor: 0,
    availableMinor: 0,
    minimumMinor: 10000,
  });
  assert.equal((await balance(db)).availableMinor, 150000);
  await assert.rejects(
    db.query(
      "select create_customer_referral_withdrawal(gen_random_uuid(),$1,0,10000)",
      [ids.referrer],
    ),
    /Invalid withdrawal amount/,
  );
  await assert.rejects(
    db.query(
      "select create_customer_referral_withdrawal(gen_random_uuid(),$1,9999,10000)",
      [ids.referrer],
    ),
    /Invalid withdrawal amount/,
  );
  await assert.rejects(
    db.query(
      "select create_customer_referral_withdrawal(gen_random_uuid(),$1,200000,10000)",
      [ids.referrer],
    ),
    /exceeds available balance/,
  );
  await assert.rejects(
    db.query(
      "select create_customer_referral_withdrawal(gen_random_uuid(),$1,10000,10000)",
      [ids.empty],
    ),
    /Payment details are incomplete/,
  );
  const created = (
    await db.query<{ value: { id: string; amountMinor: number; status: string } }>(
      "select create_customer_referral_withdrawal($1,$2,75000,10000) value",
      [request1, ids.referrer],
    )
  ).rows[0]!.value;
  assert.match(created.id, /^WDR-/);
  assert.equal(created.status, "PENDING");
  assert.deepEqual(await balance(db), {
    totalEarnedMinor: 150000,
    totalPaidMinor: 0,
    grossOutstandingMinor: 150000,
    pendingMinor: 75000,
    availableMinor: 75000,
    minimumMinor: 10000,
  });
  assert.equal(
    (
      await db.query<{ sum: number }>(
        "select sum(amount_minor)::bigint sum from referral_withdrawal_allocations where withdrawal_request_id=$1",
        [request1],
      )
    ).rows[0]!.sum,
    75000,
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::integer count from referral_commission_payouts",
      )
    ).rows[0]!.count,
    0,
  );
  const retry = (
    await db.query<{ value: { id: string } }>(
      "select create_customer_referral_withdrawal($1,$2,75000,10000) value",
      [request1, ids.referrer],
    )
  ).rows[0]!.value;
  assert.equal(retry.id, created.id);
  await assert.rejects(
    db.query(
      "select create_customer_referral_withdrawal($1,$2,76000,10000)",
      [request1, ids.referrer],
    ),
    /already used/,
  );
  const firstCommission = (
    await db.query<{ public_id: string }>(
      "select public_id from referral_commission_entitlements where referrer_id=$1 order by earned_at,id limit 1",
      [ids.referrer],
    )
  ).rows[0]!.public_id;
  const directPreview = (
    await db.query<{ value: { amountMinor: number } }>(
      "select read_admin_referral_payment_preview($1,$2) value",
      [ids.admin, firstCommission],
    )
  ).rows[0]!.value;
  assert.equal(directPreview.amountMinor, 25000);
  await db.query(
    "select record_admin_referral_payout($1,$2,$3,$4,'raw','authenticated','application/pdf',9)",
    [
      directPayment,
      ids.admin,
      firstCommission,
      `beryl-v2/referral-payouts/${firstCommission}/${directPayment}.pdf`,
    ],
  );
  assert.deepEqual(await balance(db), {
    totalEarnedMinor: 150000,
    totalPaidMinor: 25000,
    grossOutstandingMinor: 125000,
    pendingMinor: 75000,
    availableMinor: 50000,
    minimumMinor: 10000,
  });
  await db.query(
    "select reject_admin_referral_withdrawal($1,$2,'The bank destination could not be verified.')",
    [ids.admin, created.id],
  );
  assert.equal((await balance(db)).availableMinor, 125000);
  await assert.rejects(
    db.query("select begin_admin_referral_withdrawal($1,$2)", [
      ids.admin,
      created.id,
    ]),
    /Only pending/,
  );
  const cancelRow = (
    await db.query<{ value: { id: string } }>(
      "select create_customer_referral_withdrawal($1,$2,20000,10000) value",
      [cancelled, ids.referrer],
    )
  ).rows[0]!.value;
  await db.query("select cancel_customer_referral_withdrawal($1,$2)", [
    ids.referrer,
    cancelRow.id,
  ]);
  assert.equal((await balance(db)).availableMinor, 125000);
  const paidRow = (
    await db.query<{ value: { id: string } }>(
      "select create_customer_referral_withdrawal($1,$2,100000,10000) value",
      [paidRequest, ids.referrer],
    )
  ).rows[0]!.value;
  await db.query("select begin_admin_referral_withdrawal($1,$2)", [
    ids.admin,
    paidRow.id,
  ]);
  await assert.rejects(
    db.query("select cancel_customer_referral_withdrawal($1,$2)", [
      ids.referrer,
      paidRow.id,
    ]),
    /Only pending/,
  );
  assert.equal((await balance(db)).pendingMinor, 100000);
  const preview = (
    await db.query<{ value: { amountMinor: number; accountNumber: string } }>(
      "select read_admin_referral_withdrawal_payment_preview($1,$2) value",
      [ids.admin, paidRow.id],
    )
  ).rows[0]!.value;
  assert.equal(preview.amountMinor, 100000);
  assert.equal(preview.accountNumber, "0123456789");
  await db.query(
    "select record_admin_referral_withdrawal_payout($1,$2,$3,$4,'raw','authenticated','application/pdf',9)",
    [
      withdrawalPayment,
      ids.admin,
      paidRow.id,
      `beryl-v2/referral-payouts/withdrawals/${paidRow.id}/${withdrawalPayment}.pdf`,
    ],
  );
  assert.deepEqual(await balance(db), {
    totalEarnedMinor: 150000,
    totalPaidMinor: 125000,
    grossOutstandingMinor: 25000,
    pendingMinor: 0,
    availableMinor: 25000,
    minimumMinor: 10000,
  });
  assert.equal(
    (
      await db.query<{ sum: number }>(
        "select sum(amount_minor)::bigint sum from referral_commission_payout_allocations where payout_id=$1",
        [withdrawalPayment],
      )
    ).rows[0]!.sum,
    100000,
  );
  await assert.rejects(
    db.query("select reject_admin_referral_withdrawal($1,$2,'Too late')", [
      ids.admin,
      paidRow.id,
    ]),
    /Only pending/,
  );
  const customer = (
    await db.query<{
      value: {
        summary: {
          totalEarnings: number;
          paid: number;
          pendingWithdrawals: number;
          availableBalance: number;
          grossOutstanding: number;
          bankComplete: boolean;
          referrals: number;
          propertiesSold: number;
        };
        items: { paymentState: string }[];
      };
    }>("select list_customer_referrals($1,1,10) value", [ids.referrer])
  ).rows[0]!.value;
  assert.equal(customer.summary.totalEarnings, 150000);
  assert.equal(customer.summary.paid, 125000);
  assert.equal(customer.summary.availableBalance, 25000);
  assert(customer.items.some((item) => item.paymentState === "PARTIALLY_PAID"));
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::integer count from customer_completed_purchases",
      )
    ).rows[0]!.count,
    2,
  );
  assert.equal(
    (
      await db.query<{ rate: number }>(
        "select min(commission_rate_bps)::integer rate from referral_commission_entitlements",
      )
    ).rows[0]!.rate,
    200,
  );
  const concurrent = await Promise.allSettled([
    db.query<{ value: { id: string } }>(
      "select create_customer_referral_withdrawal('60000000-0000-4000-8000-000000000001',$1,20000,10000) value",
      [ids.referrer],
    ),
    db.query<{ value: { id: string } }>(
      "select create_customer_referral_withdrawal('60000000-0000-4000-8000-000000000002',$1,20000,10000) value",
      [ids.referrer],
    ),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await balance(db)).pendingMinor, 20000);
  await assert.rejects(
    db.query("set role authenticated;select * from referral_withdrawal_requests"),
  );
  await db.exec("reset role");
});

test("forward migration preserves and backfills historical payout truth", async (t) => {
  const db = await fixture(t, false),
    commission = (
      await db.query<{ public_id: string }>(
        "select public_id from referral_commission_entitlements order by earned_at limit 1",
      )
    ).rows[0]!.public_id,
    payment = "50000000-0000-4000-8000-000000000001";
  await db.query(
    "select record_admin_referral_payout($1,$2,$3,$4,'raw','authenticated','application/pdf',9)",
    [
      payment,
      ids.admin,
      commission,
      `beryl-v2/referral-payouts/${commission}/${payment}.pdf`,
    ],
  );
  const before = (
    await db.query<{ amount_minor: number; receipt_public_id: string }>(
      "select amount_minor,receipt_public_id from referral_commission_payouts where id=$1",
      [payment],
    )
  ).rows[0]!;
  await migration(db, "202609290001_customer_referral_withdrawals.sql");
  const after = (
    await db.query<{ amount_minor: number; receipt_public_id: string }>(
      "select amount_minor,receipt_public_id from referral_commission_payouts where id=$1",
      [payment],
    )
  ).rows[0]!;
  assert.deepEqual(after, before);
  assert.equal(
    (
      await db.query<{ amount_minor: number }>(
        "select amount_minor from referral_commission_payout_allocations where payout_id=$1",
        [payment],
      )
    ).rows[0]!.amount_minor,
    before.amount_minor,
  );
});
