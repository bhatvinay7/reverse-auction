# Production-Grade Observability Stack — Implementation Guide

**Stack:** OpenTelemetry (Traces) + Prometheus (Metrics + Alerting) + Loki (Logs) + Grafana (Dashboards)

---

## 1. Architecture Overview

```
                        ┌─────────────────────────┐
                        │   Application Pods       │
                        │  (OTel SDK instrumented) │
                        └──────────┬───────────────┘
                                   │ OTLP (grpc:4317 / http:4318)
                                   ▼
                        ┌─────────────────────────┐
                        │   OTel Collector          │
                        │  (DaemonSet + Gateway)    │
                        └───┬──────────┬───────────┘
                            │          │
                   traces   │          │  metrics (optional)
                            ▼          ▼
                        ┌───────┐  ┌───────────┐
                        │ Tempo │  │Prometheus │
                        └───┬───┘  └─────┬─────┘
                            │            │
    ┌──────────────┐       │            │      ┌──────────────┐
    │  Fluent Bit   │──────┼────────────┼─────▶│  Alertmanager │
    │ (DaemonSet)   │      │            │      └──────────────┘
    └──────┬────────┘      │            │
           ▼                │            │
       ┌───────┐            │            │
       │ Loki  │            │            │
       └───┬───┘            │            │
           │                │            │
           └────────────────┴────────────┴──────▶  ┌──────────┐
                                                     │ Grafana  │
                                                     └──────────┘
```

Data sources feeding Prometheus:
- `node-exporter` (DaemonSet) → node hardware (CPU, memory, disk, network)
- `kube-state-metrics` → K8s object state (pod limits/requests, restarts, OOM reason)
- `cAdvisor` (built into kubelet, scraped directly) → actual container CPU/memory usage

---

## 2. Traces — Full Request Lifecycle with Latency

### 2.1 Instrument the application (OpenTelemetry SDK)

Example (Node.js — same pattern applies to Java/Python/Go SDKs):

```javascript
// tracing.js — load before your app starts
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: process.env.K8S_NAMESPACE,
    [SemanticResourceAttributes.K8S_POD_NAME]: process.env.POD_NAME,
    [SemanticResourceAttributes.K8S_NODE_NAME]: process.env.NODE_NAME,
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector.observability.svc.cluster.local:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Inject pod/node identity via Downward API in the Deployment spec:

```yaml
env:
  - name: POD_NAME
    valueFrom: { fieldRef: { fieldPath: metadata.name } }
  - name: NODE_NAME
    valueFrom: { fieldRef: { fieldPath: spec.nodeName } }
  - name: K8S_NAMESPACE
    valueFrom: { fieldRef: { fieldPath: metadata.namespace } }
```

**Critical for "full request cycle" tracing:** propagate the `traceparent` (W3C Trace Context) header across every service hop — HTTP client, gRPC, message queue producer/consumer. Auto-instrumentation libraries do this automatically for supported frameworks; for async/queue boundaries (Kafka, SQS) you must manually inject/extract context.

### 2.2 OTel Collector config (receives, batches, exports)

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }

processors:
  batch: {}
  memory_limiter:
    limit_mib: 512
    check_interval: 5s
  tail_sampling:
    policies:
      - name: errors-always-sample
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow-requests
        type: latency
        latency: { threshold_ms: 500 }
      - name: baseline-sample
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  otlp/tempo:
    endpoint: tempo.observability.svc.cluster.local:4317
    tls: { insecure: true }

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch]
      exporters: [otlp/tempo]
```

**Sampling strategy for production:** always keep 100% of error traces and slow traces (tail_sampling above), and only probabilistically sample the "happy path" (5–10%) to control storage cost. Never blanket-sample below 100% for errors — you'll lose the exact traces you need for debugging.

### 2.3 Latency measurement

- Latency per request = span duration on the root span (captured automatically by OTel).
- Aggregate service latency (p50/p95/p99) is computed from **span metrics**, not from Tempo directly — use the OTel Collector's `spanmetrics` connector to generate RED metrics (Rate, Errors, Duration) from trace data and push them into Prometheus:

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        buckets: [10ms, 50ms, 100ms, 250ms, 500ms, 1s, 2s, 5s]
    dimensions:
      - name: http.method
      - name: http.status_code
      - name: k8s.pod.name

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp/tempo, spanmetrics]
    metrics/spanmetrics:
      receivers: [spanmetrics]
      exporters: [prometheus]
```

This gives you `traces_spanmetrics_latency_bucket` in Prometheus → PromQL for p99 latency per service:

```promql
histogram_quantile(0.99,
  sum(rate(traces_spanmetrics_latency_bucket[5m])) by (le, service_name)
)
```

Grafana panel then supports **click a slow trace → exemplar link → jump straight to that trace in Tempo → jump to logs at that exact timestamp/pod**. This trace↔metric↔log correlation is the actual differentiator of a "production-grade" setup vs three disconnected tools.

---

## 3. Metrics — Node & Pod, Max vs Current

### 3.1 Required exporters

| Component | Deploys as | Provides |
|---|---|---|
| node-exporter | DaemonSet | Node CPU/memory capacity + usage, disk, network |
| kube-state-metrics | Deployment | Pod resource **requests/limits**, restart counts, OOMKilled reason |
| cAdvisor | Built into kubelet (`/metrics/cadvisor`) | Actual container CPU/memory **usage** |

Prometheus scrape config snippet:

```yaml
scrape_configs:
  - job_name: 'kubelet-cadvisor'
    scheme: https
    kubernetes_sd_configs: [{ role: node }]
    tls_config: { insecure_skip_verify: true }
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - target_label: __address__
        replacement: kubernetes.default.svc:443
      - source_labels: [__meta_kubernetes_node_name]
        regex: (.+)
        target_label: __metrics_path__
        replacement: /api/v1/nodes/${1}/proxy/metrics/cadvisor

  - job_name: 'node-exporter'
    kubernetes_sd_configs: [{ role: endpoints }]

  - job_name: 'kube-state-metrics'
    kubernetes_sd_configs: [{ role: endpoints }]
```

### 3.2 Node — max capacity vs current usage

```promql
# Node total memory capacity
node_memory_MemTotal_bytes

# Node current used memory
node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes

# Node memory usage %
100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))

# Node CPU capacity (cores)
count(count(node_cpu_seconds_total) by (cpu, instance)) by (instance)

# Node current CPU usage %
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### 3.3 Pod — max limit vs current usage

```promql
# Pod memory limit (max allowed)
kube_pod_container_resource_limits{resource="memory"}

# Pod current memory usage
container_memory_working_set_bytes{container!=""}

# Pod memory usage % of its own limit
100 * (
  container_memory_working_set_bytes{container!=""}
  /
  on(pod, container) kube_pod_container_resource_limits{resource="memory"}
)

# Pod CPU limit (max allowed, in cores)
kube_pod_container_resource_limits{resource="cpu"}

# Pod current CPU usage (cores)
rate(container_cpu_usage_seconds_total{container!=""}[5m])

# Pod requests vs limits vs actual (all three, for right-sizing)
kube_pod_container_resource_requests{resource="memory"}
kube_pod_container_resource_limits{resource="memory"}
container_memory_working_set_bytes
```

Use `container_memory_working_set_bytes`, **not** `container_memory_usage_bytes` — working set excludes reclaimable page cache and is what the OOM killer actually evaluates against the limit.

---

## 4. Alerting (Alertmanager + Prometheus Rules)

```yaml
groups:
  - name: node-health
    rules:
      - alert: NodeMemoryPressure
        expr: (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) < 0.10
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Node {{ $labels.instance }} memory available < 10%"

      - alert: NodeHighCPU
        expr: 100 - (avg by (instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 10m
        labels: { severity: warning }

  - name: pod-health
    rules:
      - alert: PodMemoryNearLimit
        expr: |
          (container_memory_working_set_bytes{container!=""}
          / on(pod,container) kube_pod_container_resource_limits{resource="memory"}) > 0.90
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Pod {{ $labels.pod }} using >90% of its memory limit"

      - alert: PodOOMKilled
        expr: kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1
        labels: { severity: critical }

      - alert: PodCrashLoopBackOff
        expr: kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1
        for: 2m
        labels: { severity: critical }

  - name: request-slo
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR"}[5m])) by (service_name)
          / sum(rate(traces_spanmetrics_calls_total[5m])) by (service_name) > 0.05
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "{{ $labels.service_name }} error rate > 5%"

      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99, sum(rate(traces_spanmetrics_latency_bucket[5m])) by (le, service_name)) > 1
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "{{ $labels.service_name }} p99 latency > 1s"
```

Alertmanager routing (example — route critical to PagerDuty, warning to Slack):

```yaml
route:
  receiver: slack-default
  routes:
    - match: { severity: critical }
      receiver: pagerduty
    - match: { severity: warning }
      receiver: slack-default

receivers:
  - name: pagerduty
    pagerduty_configs: [{ service_key: '<PD_KEY>' }]
  - name: slack-default
    slack_configs: [{ api_url: '<SLACK_WEBHOOK>', channel: '#alerts' }]
```

---

## 5. Logs — Node + Pod, with Pod Name and Error Extraction

### 5.1 Fluent Bit config (DaemonSet, tails container logs from every node)

```ini
[INPUT]
    Name              tail
    Path              /var/log/containers/*.log
    Parser            docker
    Tag               kube.*
    Mem_Buf_Limit     10MB
    Skip_Long_Lines   On

[FILTER]
    Name                kubernetes
    Match               kube.*
    Kube_URL            https://kubernetes.default.svc:443
    Merge_Log           On
    Keep_Log            Off
    K8S-Logging.Parser  On
    Labels              On
    Annotations         Off
    # This filter enriches every log line with:
    # kubernetes.pod_name, kubernetes.namespace_name,
    # kubernetes.container_name, kubernetes.host (node name)

[FILTER]
    Name    grep
    Match   kube.*
    Regex   log (error|Error|ERROR|exception|Exception|panic|fatal)

[OUTPUT]
    Name        loki
    Match       kube.*
    Host        loki.observability.svc.cluster.local
    Port        3100
    Labels      job=fluentbit, pod=$kubernetes['pod_name'], namespace=$kubernetes['namespace_name'], node=$kubernetes['host'], container=$kubernetes['container_name']
    Line_Format json
```

Notes:
- The `kubernetes` filter is what attaches **pod name, namespace, node, container** as labels automatically — this is how you get "which pod/node did this log come from" without manual tagging.
- The second `grep` filter above is optional — use it only if you want a **separate error-only stream** in addition to full logs (common pattern: ship everything to Loki, but also forward matched errors to a dedicated Slack/PagerDuty channel via a second OUTPUT block).
- Node-level (kubelet/systemd) logs need a second INPUT block pointing at `/var/log/syslog` or `journald` if you need OS-level logs, not just container logs.

### 5.2 LogQL queries (Loki, in Grafana)

```logql
# All logs for a specific pod
{pod="checkout-service-7db9-abc12"}

# All error logs across a namespace
{namespace="production"} |= "error"

# Error logs grouped by pod (see which pods are noisiest)
sum by (pod) (count_over_time({namespace="production"} |= "error" [5m]))

# Logs from a specific node (host-level debugging)
{node="ip-10-0-1-23.ec2.internal"}

# Structured JSON log filtering (if app logs JSON)
{namespace="production"} | json | level="error"
```

---

## 6. Grafana Dashboards — Separated Views (Not One Mega-Dashboard)

Production convention: **one dashboard per concern**, linked via a shared top-level "Overview" dashboard, using **template variables** (dropdowns) to scope each view instead of graphing everything at once.

### 6.1 Recommended dashboard structure

```
Dashboard: "Node Overview"
  Variables: $node (dropdown, multi-select, from label_values(node_uname_info, instance))
  Panels: CPU used vs capacity | Memory used vs capacity | Disk | Network

Dashboard: "Pod Resource Usage"
  Variables: $namespace → $pod (cascading dropdowns)
  Panels: Memory usage vs limit (gauge) | CPU usage vs limit (gauge) | Restart count | OOMKill events

Dashboard: "Request Tracing / Latency"
  Variables: $service (dropdown, from label_values(traces_spanmetrics_calls_total, service_name))
  Panels: p50/p95/p99 latency | Error rate | Trace exemplar table (click-through to Tempo)

Dashboard: "Logs Explorer"
  Variables: $namespace → $pod (cascading), $log_level
  Panels: Log volume over time | Live log stream (Loki panel) | Error count by pod

Dashboard: "Alerts / SLO Overview"
  Panels: Firing alerts table | Error budget burn rate | Alert history
```

### 6.2 Template variable definitions (add under Dashboard Settings → Variables)

```
Name: node
Type: Query
Data source: Prometheus
Query: label_values(node_uname_info, instance)
Multi-value: enabled

Name: namespace
Type: Query
Query: label_values(kube_pod_info, namespace)

Name: pod
Type: Query
Query: label_values(kube_pod_info{namespace="$namespace"}, pod)
(this makes pod dropdown depend on the namespace dropdown selected above)

Name: service
Type: Query
Data source: Prometheus
Query: label_values(traces_spanmetrics_calls_total, service_name)
```

Every panel query then references `$node`, `$namespace`, `$pod`, or `$service` instead of hardcoding — so switching the dropdown re-scopes every panel on that dashboard, and each concern (nodes / pods / traces / logs) stays on its own dashboard instead of one unreadable wall of graphs.

### 6.3 Cross-linking (what makes it "full production grade")

In Grafana, add **data links** on panels:
- On a pod memory panel → link to "Logs Explorer" dashboard pre-filtered to that `$pod`.
- On a latency panel → enable **exemplars** so clicking a data point jumps to the actual trace in Tempo.
- On a trace span in Tempo → "Logs for this span" link filtered by `pod` + time range ±30s.

This closes the loop: **alert fires → dashboard shows which pod/node → click through to its logs → click through to the exact trace** — without manually re-typing filters across tools.

---

## 7. Must-Have vs Nice-to-Have Summary

| Layer | Must-have | Nice-to-have (scale up later) |
|---|---|---|
| Traces | OTel SDK, OTel Collector, Tempo, tail-sampling | Service mesh (Istio/Linkerd) for network-level traces |
| Metrics | node-exporter, kube-state-metrics, cAdvisor, Prometheus | Thanos/Mimir for long-term multi-cluster storage |
| Logs | Fluent Bit, Loki | Fluentd as aggregation layer for heavy transforms |
| Alerting | Alertmanager + Prometheus rules | Sloth/Grafana SLO for error-budget tracking |
| Dashboards | Grafana with templated, separated dashboards | Goldilocks (VPA UI) for auto right-sizing suggestions |

This entire stack (Loki, Grafana, Tempo, Prometheus/Mimir) is the standard **"LGTM" stack** and is natively cross-linked inside Grafana — no custom glue code required beyond the configs above.

---

## 8. Per-Project Stack Status & Alerting Connections

Grafana credentials for all three projects: **`admin` / `admin`**

### 8.1 Connection map (what talks to what)

```
App Pods  ──OTLP gRPC 4317──▶  OTel Collector  ──▶  Tempo       (traces)
                                                 ──▶  Prometheus  (spanmetrics via connector)
                                                 ──▶  Loki        (logs from Fluent-Bit → OTel)
Fluent-Bit (DaemonSet)  ──OTLP HTTP 4318──▶  OTel Collector
Prometheus  ──scrape 8889──▶  OTel Collector metrics port
Alertmanager  ◀──  Prometheus  (fires rules on spanmetrics + kube metrics)
Grafana  ◀──  Prometheus / Tempo / Loki  (three preconfigured datasources)
```

### 8.2 Auction (`grafana.aquabid.bookit4u.shop`)

| Component | Status | Notes |
|-----------|--------|-------|
| OTel Collector | ✅ | spanmetrics connector, exports to Tempo + Prometheus + Loki |
| Tempo | ✅ | Local storage, 72h retention |
| Loki | ✅ | Via loki-stack Helm chart |
| Fluent-Bit | ✅ | Forwards to OTel Collector as OTLP logs |
| Grafana datasources | ✅ | Prometheus + Tempo + Loki, full cross-linking |
| Traces → Logs | ✅ | `tracesToLogsV2` on Tempo datasource |
| Traces → Metrics | ✅ | `tracesToMetrics` → Prometheus spanmetrics |
| Logs → Traces | ✅ | `derivedFields` TraceID regex on Loki datasource |
| Alertmanager | ✅ | Deployed (configure receiver in `additionalPrometheusRules`) |
| Admin credentials | ✅ | `admin` / `admin` |

**Alerting connections to add** (in `prometheus-grafana.yaml` under `alertmanager.config`):
```yaml
alertmanager:
  config:
    global:
      slack_api_url: '<SLACK_WEBHOOK_URL>'
    route:
      receiver: slack-default
      routes:
        - matchers: [severity="critical"]
          receiver: slack-critical
    receivers:
      - name: slack-default
        slack_configs:
          - channel: '#auction-alerts'
            title: '[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
      - name: slack-critical
        slack_configs:
          - channel: '#auction-oncall'
```

---

### 8.3 Bookit (`grafana.bookit4u.shop`)

| Component | Status | Notes |
|-----------|--------|-------|
| OTel Collector | ✅ | spanmetrics connector, 2 replicas |
| Tempo | ✅ | Via Helm chart |
| Loki | ✅ | Via loki-stack Helm chart |
| Fluent-Bit | ✅ | Forwards to OTel Collector |
| Grafana datasources | ✅ | All three, full cross-linking added |
| Traces → Logs | ✅ | `tracesToLogsV2` |
| Traces → Metrics | ✅ | `tracesToMetrics` → Prometheus |
| Logs → Traces | ✅ | `derivedFields` TraceID regex |
| Alertmanager | ✅ | Gmail SMTP configured (`smtp.gmail.com:587`) |
| Admin credentials | ✅ | `admin` / `admin` |

**Required for Gmail alerting** — the Gmail App Password in `prometheus-grafana.yaml` must be set:
```yaml
# In alertmanager.config.global:
smtp_auth_password: '<16-char Google App Password>'
# Generate at: https://myaccount.google.com/apppasswords
# Requires 2FA enabled on the Google account.
```

---

### 8.4 Chess-Dev (`grafana.chesscounty.life`)

| Component | Status | Notes |
|-----------|--------|-------|
| OTel Collector | ✅ **ADDED** | `monitoring/otel-collector.yaml` created |
| Tempo | ✅ **ADDED** | `monitoring/tempo.yaml` created |
| Loki | ✅ | Via loki-stack (was already present) |
| Fluent-Bit | ✅ **ADDED** | `monitoring/fluent-bit.yaml` created |
| Grafana datasources | ✅ **FIXED** | Tempo + Loki with full cross-linking added |
| Traces → Logs | ✅ **ADDED** | `tracesToLogsV2` |
| Traces → Metrics | ✅ **ADDED** | `tracesToMetrics` → Prometheus spanmetrics |
| Logs → Traces | ✅ **ADDED** | `derivedFields` TraceID regex |
| Alertmanager | ✅ **ADDED** | Deployed, configure receiver below |
| Admin credentials | ✅ **FIXED** | Was `admini/admini`, now `admin`/`admin` |

**Alerting connections to add** — add `alertmanager.config` to `monitoring/prometheus-grafana.yaml`:
```yaml
alertmanager:
  config:
    global:
      slack_api_url: '<SLACK_WEBHOOK_URL>'
    route:
      receiver: slack-default
      routes:
        - matchers: [severity="critical"]
          receiver: slack-critical
    receivers:
      - name: slack-default
        slack_configs:
          - channel: '#chess-alerts'
      - name: slack-critical
        slack_configs:
          - channel: '#chess-oncall'
```

---

### 8.5 Application instrumentation endpoint

All apps must export telemetry to the OTel Collector. Set this env var on every Deployment/Pod:

```yaml
env:
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "http://otel-collector.monitoring.svc.cluster.local:4317"
  - name: OTEL_EXPORTER_OTLP_PROTOCOL
    value: "grpc"
  - name: OTEL_SERVICE_NAME
    value: "<service-name>"   # e.g. auction-engine, bookit-api, chess-game
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: "k8s.namespace.name=$(K8S_NAMESPACE),k8s.pod.name=$(POD_NAME)"
  - name: K8S_NAMESPACE
    valueFrom: { fieldRef: { fieldPath: metadata.namespace } }
  - name: POD_NAME
    valueFrom: { fieldRef: { fieldPath: metadata.name } }
```

The Rust auction-engine already uses `auction_observability` which wraps the `opentelemetry-otlp` exporter — just ensure `OTEL_EXPORTER_OTLP_ENDPOINT` is set in the Deployment env.