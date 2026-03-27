// OpenTelemetry instrumentation for Kubiks
import { trace } from '@opentelemetry/api';

try {
  const { WebTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } = await import('@opentelemetry/sdk-trace-web');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { registerInstrumentations } = await import('@opentelemetry/instrumentation');
  const { getWebAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-web');

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

export {};
