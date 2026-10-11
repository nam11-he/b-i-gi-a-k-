-- Phase 10: transactional outbox, same as exercise-service. An event is written in the same transaction as the change it describes
-- (e.g. deleting a user), then OutboxPublisher sends it to RabbitMQ and sets published_at. Nothing is lost when
-- the broker is down: the row waits and is sent on a later run.
CREATE TABLE outbox_events (
    id           UUID PRIMARY KEY,
    event_type   VARCHAR(100) NOT NULL,
    payload      TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL,
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_events_pending ON outbox_events (created_at) WHERE published_at IS NULL;
