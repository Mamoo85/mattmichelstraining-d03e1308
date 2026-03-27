import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.VITE_OTEL_SERVICE_NAME || 'm2training',
  }),
);

const provider = new BasicTracerProvider({
  resource,
});

// OTLP exporter for Kubiks
const otlpExporter = new OTLPTraceExporter({
  url: process.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || 'https://ingest.kubiks.app/v1/traces',
  headers: process.env.VITE_OTEL_EXPORTER_OTLP_HEADERS
    ? { 'x-kubiks-key': process.env.VITE_OTEL_EXPORTER_OTLP_HEADERS.split('=')[1] }
    : undefined,
});

// Console exporter for development
const consoleExporter = new ConsoleSpanExporter();

provider.addSpanProcessor(new SimpleSpanProcessor(otlpExporter));

// Add console exporter in development
if (process.env.NODE_ENV === 'development') {
  provider.addSpanProcessor(new SimpleSpanProcessor(consoleExporter));
}

provider.register();

registerInstrumentations({
  instrumentations: getWebAutoInstrumentations({
    '@opentelemetry/instrumentation-fetch': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-xml-http-request': {
      enabled: true,
    },
  }),
});

export default provider;
