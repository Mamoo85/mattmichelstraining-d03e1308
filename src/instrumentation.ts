// OpenTelemetry instrumentation for Kubiks
import { trace } from '@opentelemetry/api';
import { WebTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

try {
  const otlpExporter = new OTLPTraceExporter({
    url: import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || 'https://ingest.kubiks.app/v1/traces',
    headers: import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS
      ? { 'x-kubiks-key': (import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS as string).split('=')[1] }
      : undefined,
  });

  const spanProcessors = [new SimpleSpanProcessor(otlpExporter)];
  if (import.meta.env.DEV) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  const provider = new WebTracerProvider({ spanProcessors });
  provider.register();
  trace.setGlobalTracerProvider(provider);

  registerInstrumentations({
    instrumentations: getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': { enabled: true },
      '@opentelemetry/instrumentation-xml-http-request': { enabled: true },
    }),
  });
} catch (e) {
  console.warn('[OTel] Instrumentation init failed:', e);
}

export default {};
