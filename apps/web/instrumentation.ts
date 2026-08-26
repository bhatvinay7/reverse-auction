import { registerOTel } from '@vercel/otel';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

export function register() {
  // Explicitly set the W3C traceparent propagator
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  
  registerOTel({ 
    serviceName: 'aqua-bid-web',
  });
}
