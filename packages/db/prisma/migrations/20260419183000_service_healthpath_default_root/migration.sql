-- Safer default for Traefik→Traefik or Host-based backends where `/` returns 2xx but `/api/health` may not exist.
ALTER TABLE "Service" ALTER COLUMN "healthPath" SET DEFAULT '/';
