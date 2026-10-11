package vn.edu.qnu.st.nambede.auth.events;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitOperations;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class OutboxPublisherTest {

    @Mock
    private OutboxRepository repository;
    @Mock
    private RabbitTemplate rabbitTemplate;

    private final RabbitOperations operations = mock(RabbitOperations.class);
    private OutboxPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new OutboxPublisher(repository, rabbitTemplate);
    }

    private static OutboxEvent event(String payload) {
        return new OutboxEvent(UUID.randomUUID(), Events.USER_DELETED, payload, Instant.parse("2026-10-10T08:00:00Z"));
    }

    /** The template runs the callback on a channel; here the channel is a mock that records what was sent. */
    private void brokerUp() {
        when(rabbitTemplate.invoke(any())).thenAnswer(invocation ->
                invocation.<RabbitOperations.OperationsCallback<?>>getArgument(0).doInRabbit(operations));
    }

    @Test
    void sendsPendingEventsInOrderAndMarksThemSent() {
        OutboxEvent first = event("{\"n\":1}");
        OutboxEvent second = event("{\"n\":2}");
        when(repository.findTop100ByPublishedAtIsNullOrderByCreatedAtAsc()).thenReturn(List.of(first, second));
        brokerUp();

        assertThat(publisher.publishPending()).isEqualTo(2);

        ArgumentCaptor<Message> sent = ArgumentCaptor.forClass(Message.class);
        verify(operations, org.mockito.Mockito.times(2))
                .send(eq(Events.EXCHANGE), eq(Events.USER_DELETED), sent.capture());
        assertThat(sent.getAllValues()).extracting(message -> new String(message.getBody(), StandardCharsets.UTF_8))
                .containsExactly("{\"n\":1}", "{\"n\":2}");
        Message message = sent.getAllValues().get(0);
        assertThat(message.getMessageProperties().getMessageId()).isEqualTo(first.getId().toString());
        assertThat(message.getMessageProperties().getContentType()).isEqualTo("application/json");
        // Waits for the broker to confirm before the event counts as sent
        verify(operations, org.mockito.Mockito.times(2)).waitForConfirmsOrDie(any(Long.class));
        assertThat(first.getPublishedAt()).isNotNull();
        assertThat(second.getPublishedAt()).isNotNull();
    }

    @Test
    void brokerDownKeepsTheEventsForTheNextRun() {
        OutboxEvent waiting = event("{}");
        when(repository.findTop100ByPublishedAtIsNullOrderByCreatedAtAsc()).thenReturn(List.of(waiting));
        when(rabbitTemplate.invoke(any())).thenThrow(new AmqpConnectException(new java.net.ConnectException("refused")));

        assertThat(publisher.publishPending()).isZero();

        assertThat(waiting.getPublishedAt()).isNull();
    }

    @Test
    void stopsAtTheFirstFailureSoTheOrderIsKept() {
        OutboxEvent first = event("{\"n\":1}");
        OutboxEvent second = event("{\"n\":2}");
        when(repository.findTop100ByPublishedAtIsNullOrderByCreatedAtAsc()).thenReturn(List.of(first, second));
        when(rabbitTemplate.invoke(any()))
                .thenAnswer(invocation -> invocation.<RabbitOperations.OperationsCallback<?>>getArgument(0).doInRabbit(operations))
                .thenThrow(new AmqpConnectException(new java.net.ConnectException("refused")));

        assertThat(publisher.publishPending()).isEqualTo(1);

        assertThat(first.getPublishedAt()).isNotNull();
        assertThat(second.getPublishedAt()).isNull();
    }

    @Test
    void outboxWritesTheEnvelopeAsJson() {
        OutboxRepository saved = mock(OutboxRepository.class);
        JsonMapper jsonMapper = JsonMapper.builder().build();
        org.slf4j.MDC.put("requestId", "gw-123"); // as RequestIdFilter leaves it during a request
        try {
            new Outbox(saved, jsonMapper).add(Events.USER_DELETED, new Data(50L, Instant.parse("2026-10-10T08:00:00Z")));
        } finally {
            org.slf4j.MDC.remove("requestId");
        }

        ArgumentCaptor<OutboxEvent> row = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(saved).save(row.capture());
        JsonNode json = jsonMapper.readTree(row.getValue().getPayload());
        assertThat(json.get("id").asString()).isEqualTo(row.getValue().getId().toString());
        assertThat(json.get("requestId").asString()).isEqualTo("gw-123");
        assertThat(json.get("type").asString()).isEqualTo(Events.USER_DELETED);
        assertThat(json.get("data").get("submissionId").asLong()).isEqualTo(50L);
        // Dates as ISO-8601 text, which every language reads (Python: datetime.fromisoformat)
        assertThat(json.get("data").get("submittedAt").asString()).isEqualTo("2026-10-10T08:00:00Z");
        assertThat(row.getValue().getPublishedAt()).isNull();
    }

    record Data(Long submissionId, Instant submittedAt) {
    }
}
