-- Fix collation warnings for all databases
UPDATE pg_database SET datcollversion = NULL WHERE datname IN ('todoapp', 'postgres', 'template1', 'template0');

-- Verify the fix
SELECT datname, datcollversion FROM pg_database;