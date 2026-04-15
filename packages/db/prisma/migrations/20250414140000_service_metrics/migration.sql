-- Optional Prometheus scrape settings per service.

ALTER TABLE "Service" ADD COLUMN "metricsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN "metricsPath" TEXT NOT NULL DEFAULT '/metrics';
ALTER TABLE "Service" ADD COLUMN "metricsPort" INTEGER;
