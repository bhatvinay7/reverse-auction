use std::{
    collections::HashMap,
    env,
    panic::{self, PanicHookInfo},
    sync::OnceLock,
    time::Duration,
    time::{SystemTime, UNIX_EPOCH},
};

use opentelemetry::{
    KeyValue, global,
    metrics::Counter,
    trace::{TraceContextExt, TracerProvider as _},
};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    Resource, metrics::SdkMeterProvider, propagation::TraceContextPropagator,
    trace::SdkTracerProvider,
};
use serde::Serialize;
use serde_json::{Value, json};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

pub use tracing;

static ERROR_COUNTER: OnceLock<Counter<u64>> = OnceLock::new();

/// Serializes the active W3C trace context for transport through Kafka or gRPC
/// metadata. The carrier contains `traceparent` and, when present, `tracestate`.
pub fn current_trace_context() -> HashMap<String, String> {
    let mut carrier = HashMap::new();
    global::get_text_map_propagator(|propagator| {
        propagator.inject_context(&tracing::Span::current().context(), &mut carrier);
    });
    carrier
}

/// Makes an incoming W3C carrier the parent of a newly-created tracing span.
pub fn set_parent_from_trace_context(span: &tracing::Span, carrier: &HashMap<String, String>) {
    let parent = global::get_text_map_propagator(|propagator| propagator.extract(carrier));
    let _ = span.set_parent(parent);
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorEvent {
    pub event_id: String,
    pub event_type: &'static str,
    pub severity: &'static str,
    pub service: String,
    pub code: String,
    pub message: String,
    pub occurred_at_ms: u64,
    pub environment: String,
    pub region: String,
    pub host: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span_id: Option<String>,
    pub context: Value,
}

impl ErrorEvent {
    fn new(
        service: &str,
        severity: &'static str,
        code: &str,
        message: String,
        context: Value,
    ) -> Self {
        let span_context = tracing::Span::current().context();
        let span = span_context.span();
        let span_context = span.span_context();
        let (trace_id, span_id) = span_context
            .is_valid()
            .then(|| {
                (
                    span_context.trace_id().to_string(),
                    span_context.span_id().to_string(),
                )
            })
            .map_or((None, None), |(trace_id, span_id)| {
                (Some(trace_id), Some(span_id))
            });
        Self {
            event_id: Uuid::new_v4().to_string(),
            event_type: "service_error",
            severity,
            service: service.to_string(),
            code: code.to_string(),
            message,
            occurred_at_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            environment: env::var("AUCTION_ENVIRONMENT")
                .or_else(|_| env::var("APP_ENV"))
                .unwrap_or_else(|_| "unknown".to_string()),
            region: env::var("AUCTION_REGION")
                .or_else(|_| env::var("APP_REGION"))
                .unwrap_or_else(|_| "unknown".to_string()),
            host: env::var("HOSTNAME").unwrap_or_else(|_| "unknown".to_string()),
            trace_id,
            span_id,
            context,
        }
    }
}

pub struct TelemetryGuard {
    tracer_provider: SdkTracerProvider,
    meter_provider: SdkMeterProvider,
}

impl Drop for TelemetryGuard {
    fn drop(&mut self) {
        if let Err(error) = self.tracer_provider.shutdown() {
            eprintln!("failed to shut down OpenTelemetry tracer provider: {error}");
        }
        if let Err(error) = self.meter_provider.shutdown() {
            eprintln!("failed to shut down OpenTelemetry meter provider: {error}");
        }
    }
}

pub fn init_telemetry(service: &'static str) -> Result<TelemetryGuard, std::io::Error> {
    install_panic_hook(service);
    global::set_text_map_propagator(TraceContextPropagator::new());

    let endpoint = env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://127.0.0.1:4317".to_string());
    let resource = Resource::builder()
        .with_service_name(service)
        .with_attributes([
            KeyValue::new(
                "deployment.environment.name",
                env::var("AUCTION_ENVIRONMENT").unwrap_or_else(|_| "unknown".to_string()),
            ),
            KeyValue::new(
                "cloud.region",
                env::var("AUCTION_REGION").unwrap_or_else(|_| "unknown".to_string()),
            ),
            KeyValue::new(
                "service.instance.id",
                env::var("HOSTNAME").unwrap_or_else(|_| Uuid::new_v4().to_string()),
            ),
        ])
        .build();

    let span_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(endpoint.clone())
        .with_timeout(Duration::from_secs(5))
        .build()
        .map_err(std::io::Error::other)?;
    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(resource.clone())
        .with_batch_exporter(span_exporter)
        .build();
    let tracer = tracer_provider.tracer(service);
    global::set_tracer_provider(tracer_provider.clone());

    let metric_exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_tonic()
        .with_endpoint(endpoint)
        .with_timeout(Duration::from_secs(5))
        .build()
        .map_err(std::io::Error::other)?;
    let meter_provider = SdkMeterProvider::builder()
        .with_resource(resource)
        .with_periodic_exporter(metric_exporter)
        .build();
    global::set_meter_provider(meter_provider.clone());

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,hyper=warn,h2=warn,rdkafka=warn,tower_http=info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_current_span(true)
                .with_span_list(true),
        )
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .try_init()
        .map_err(std::io::Error::other)?;

    global::meter("auction-observability")
        .u64_counter("auction_service_starts")
        .with_description("Number of auction service process starts")
        .build()
        .add(1, &[KeyValue::new("service", service)]);
    tracing::info!(service, "OpenTelemetry tracing and metrics initialized");

    Ok(TelemetryGuard {
        tracer_provider,
        meter_provider,
    })
}

/// Writes one JSON object to stderr. Kubernetes captures it and Fluent Bit sends
/// it through the OpenTelemetry Collector to Loki, where Grafana can query
/// `event_type="service_error"`.
pub fn report_error(service: &str, code: &str, message: impl Into<String>, context: Value) {
    ERROR_COUNTER
        .get_or_init(|| {
            global::meter("auction-observability")
                .u64_counter("auction_service_errors")
                .with_description("Structured service errors emitted by auction workloads")
                .build()
        })
        .add(
            1,
            &[
                KeyValue::new("service", service.to_string()),
                KeyValue::new("code", code.to_string()),
            ],
        );
    emit(ErrorEvent::new(
        service,
        "ERROR",
        code,
        message.into(),
        context,
    ));
}

pub fn install_panic_hook(service: &'static str) {
    let previous = panic::take_hook();
    panic::set_hook(Box::new(move |info: &PanicHookInfo<'_>| {
        let payload = if let Some(message) = info.payload().downcast_ref::<&str>() {
            (*message).to_string()
        } else if let Some(message) = info.payload().downcast_ref::<String>() {
            message.clone()
        } else {
            "non-string panic payload".to_string()
        };
        let location = info.location().map(|location| {
            json!({
                "file": location.file(),
                "line": location.line(),
                "column": location.column(),
            })
        });
        let thread_name = std::thread::current()
            .name()
            .unwrap_or("unnamed")
            .to_string();
        emit(ErrorEvent::new(
            service,
            "CRITICAL",
            "process_panic",
            payload,
            json!({"thread": thread_name, "location": location}),
        ));
        previous(info);
    }));
}

fn emit(event: ErrorEvent) {
    match serde_json::to_string(&event) {
        Ok(payload) => eprintln!("{payload}"),
        Err(error) => eprintln!(
            "{{\"event_type\":\"error_reporter_failure\",\"message\":{:?}}}",
            error.to_string()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_event_has_queryable_dimensions() {
        let event = ErrorEvent::new(
            "auction-engine",
            "ERROR",
            "redis_write",
            "write failed".to_string(),
            json!({"auction_id": "auction-1"}),
        );
        let value = serde_json::to_value(event).expect("error event should serialize");

        assert_eq!(value["event_type"], "service_error");
        assert_eq!(value["service"], "auction-engine");
        assert_eq!(value["code"], "redis_write");
        assert_eq!(value["context"]["auction_id"], "auction-1");
    }
}
