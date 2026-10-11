package vn.edu.qnu.st.nambede.auth.events;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends the events waiting in the outbox to RabbitMQ every few seconds and marks each one sent once the broker
 * confirms it. Broker down: the events stay in the table and the next run tries again.
 *
 * <p>Delivery is at least once: if the service stops between the confirm and the commit, the event is sent again.
 * Consumers therefore handle an event twice without harm (deleting data that is already gone does nothing).
 */
@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final long CONFIRM_TIMEOUT_MS = 5_000;
    /** Sent events are kept a week for troubleshooting, then deleted. */
    static final Duration KEEP_PUBLISHED = Duration.ofDays(7);

    private final OutboxRepository repository;
    private final RabbitTemplate rabbitTemplate;

    public OutboxPublisher(OutboxRepository repository, RabbitTemplate rabbitTemplate) {
        this.repository = repository;
        this.rabbitTemplate = rabbitTemplate;
    }

    /** Returns how many events were sent. */
    @Scheduled(fixedDelayString = "${app.events.publish-interval-ms:2000}")
    @Transactional
    public int publishPending() {
        List<OutboxEvent> pending = repository.findTop100ByPublishedAtIsNullOrderByCreatedAtAsc();
        int sent = 0;
        for (OutboxEvent event : pending) {
            try {
                send(event);
            } catch (AmqpException ex) {
                // Keep the order: stop here and start again from this event on the next run
                log.warn("RabbitMQ did not take event {} ({}), {} event(s) wait in the outbox: {}", event.getId(),
                        event.getEventType(), pending.size() - sent, ex.getMessage());
                break;
            }
            event.markPublished(Instant.now());
            sent++;
        }
        repository.deletePublishedBefore(Instant.now().minus(KEEP_PUBLISHED));
        return sent;
    }

    private void send(OutboxEvent event) {
        MessageProperties properties = new MessageProperties();
        properties.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        properties.setContentEncoding(StandardCharsets.UTF_8.name());
        properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        properties.setMessageId(event.getId().toString());
        properties.setType(event.getEventType());
        properties.setTimestamp(Date.from(event.getCreatedAt()));
        Message message = new Message(event.getPayload().getBytes(StandardCharsets.UTF_8), properties);
        rabbitTemplate.invoke(operations -> {
            operations.send(Events.EXCHANGE, event.getEventType(), message);
            operations.waitForConfirmsOrDie(CONFIRM_TIMEOUT_MS);
            return null;
        });
    }
}
