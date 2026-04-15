-- Align default health check path with Nest RestController (/api/health).

ALTER TABLE "Service" ALTER COLUMN "healthPath" SET DEFAULT '/api/health';

UPDATE "Service" SET "healthPath" = '/api/health' WHERE "healthPath" = '/health';
