---
title: "The Transactional Outbox: keeping your database and Kafka in agreement"
date: 2026-10-03
summary: "Writing to a database and publishing to Kafka looks like one step but is really two. The outbox pattern makes them agree without distributed transactions."
tags: [kafka, messaging, design-patterns]
draft: false
---

A service saves an order, then tells the rest of the system about it. In code that is two lines, and it feels like one operation:

```ts
await db.insert(order);
await kafka.send({ topic: 'orders.events', messages: [orderPlaced(order)] });
```

It is two operations against two different systems, and nothing makes them succeed or fail together. This is the **dual write problem**, and the transactional outbox is the standard way out of it.

## What goes wrong

Consider the ways those two lines can fail:

- The process crashes **between** them. The order exists, but nobody is ever told.
- Kafka is unavailable. The order is saved, the publish throws, and you are left deciding whether to roll back a write that already committed.
- You swap the order and publish first. Now a crash, or a failed commit, means the world has been told about an order that does not exist.

Retrying does not fix this, because the failure you care about is the process dying, and a dead process cannot retry.

## Why not a distributed transaction?

Two-phase commit across the database and Kafka would solve it in theory, but Kafka does not take part in XA transactions. Kafka's own transactions are real, but they only cover work done inside Kafka (producing to several topics, or consuming and producing atomically). They cannot include your database write.

So instead of making two systems agree, we make **one system the source of truth** and copy from it.

## The pattern

Write the event to an `outbox` table **in the same database transaction** as the business change. A separate process then reads the outbox and publishes to Kafka.

```text
┌─────────── one database transaction ───────────┐
│  INSERT INTO orders ...                         │
│  INSERT INTO outbox ...                         │
└─────────────────────────────────────────────────┘
                      │
          relay (polling or CDC) reads outbox
                      │
                      ▼
              Kafka topic ──► consumers
```

Because both rows commit together, they either both exist or neither does. The "tell everyone" step has moved out of the request path and become something that can be retried safely for as long as it takes.

A minimal outbox table in Postgres:

```sql
CREATE TABLE outbox (
  id             bigserial   PRIMARY KEY,
  aggregate_type text        NOT NULL,
  aggregate_id   uuid        NOT NULL,
  event_type     text        NOT NULL,
  payload        jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz
);

-- Keeps the "what is left to send?" query cheap however big the table gets.
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;
```

And the write side, using `pg`:

```ts
async function placeOrder(db: Pool, cmd: PlaceOrder): Promise<string> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [order] } = await client.query(
      'INSERT INTO orders (customer_id, total_pence) VALUES ($1, $2) RETURNING id',
      [cmd.customerId, cmd.totalPence],
    );

    await client.query(
      `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('order', $1, 'OrderPlaced', $2)`,
      [order.id, JSON.stringify({ orderId: order.id, ...cmd })],
    );

    await client.query('COMMIT');
    return order.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

Nothing here talks to Kafka. The request succeeds or fails purely on the database.

## Getting rows out: two relays

**1. A polling publisher.** A small loop selects unpublished rows, sends them, and marks them as published.

```ts
async function relayOnce(db: Pool, producer: Producer, batchSize = 100) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, aggregate_id, event_type, payload
         FROM outbox
        WHERE published_at IS NULL
        ORDER BY id
        LIMIT $1
          FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );

    if (rows.length > 0) {
      await producer.send({
        topic: 'orders.events',
        messages: rows.map((r) => ({
          key: r.aggregate_id,
          value: JSON.stringify(r.payload),
          headers: { 'event-id': String(r.id), 'event-type': r.event_type },
        })),
      });
      await client.query('UPDATE outbox SET published_at = now() WHERE id = ANY($1)', [
        rows.map((r) => r.id),
      ]);
    }

    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

It is simple, has no extra infrastructure, and is easy to reason about. The cost is a little latency (the polling interval) and constant light load on the database.

**2. Change data capture (CDC).** Instead of polling, a tool such as Debezium tails the database's write-ahead log and turns each new outbox row into a Kafka message. Debezium even ships an outbox event router for this. Latency is lower, the database is not being polled, and the order of events follows the commit order. The price is running and operating Kafka Connect and a connector.

I would start with polling and move to CDC when latency or database load makes it worth the extra moving parts.

## The part people skip: duplicates

Look at the relay again. If it publishes to Kafka and then crashes **before** marking the rows as published, the next run sends them again. You cannot close that gap without a transaction spanning both systems, which is where we started.

So the outbox gives you **at-least-once delivery**, not exactly-once. That is a perfectly good guarantee as long as consumers are **idempotent**. The usual approach is to record the ids of events you have handled and ignore repeats:

```sql
CREATE TABLE processed_events (
  event_id     text        PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
```

```ts
// Inside the same transaction as the consumer's own database changes
const { rowCount } = await client.query(
  'INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
  [eventId],
);
if (rowCount === 0) return; // already handled, skip it
```

Do this in the same transaction as the work the event triggers, so "handled" and "recorded as handled" cannot drift apart. It is the consumer-side mirror of the outbox.

## Ordering

Kafka only orders messages within a partition, so use the aggregate id as the message key. Every event for one order then lands in the same partition, in order.

Be careful with how you relay, though:

- A **single** polling relay preserves order. Several relays using `SKIP LOCKED` can publish two events for the same aggregate out of order, because they hold different batches. If you need parallelism, partition the outbox by a hash of the aggregate id and give each partition one relay.
- Do not track progress with `WHERE id > last_seen_id`. Sequence values are handed out when the insert runs, but rows only become visible when the transaction commits, so a slow transaction can commit a lower id *after* you have moved past it. The `published_at IS NULL` flag does not have this problem.
- CDC reads the log in commit order, which sidesteps both issues.

## Housekeeping

The outbox only grows. Delete published rows after a retention period (a day or a week is plenty), or partition the table by time and drop old partitions. Keep an eye on the age of the oldest unpublished row. If it keeps climbing, your relay is stuck, and that is a better alert than anything on the Kafka side.

## When it is worth it

Use an outbox when a database change **must** be accompanied by an event, and losing either one would be a bug: orders, payments, account changes. If an occasional lost notification is harmless, a plain publish after commit is much less work.

What you get is a clear split of responsibilities:

1. The database transaction decides what is true.
2. The outbox records what must be announced.
3. The relay announces it, as many times as it takes.
4. Consumers tolerate hearing it twice.

None of the pieces is clever. Together they replace a distributed transaction you cannot have with a small amount of ordinary SQL.
