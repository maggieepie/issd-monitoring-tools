-- MONITORING_OUTGOING — Outgoing document monitoring (ISSD monitoring tools backend)
--
-- Run this script as the app Oracle user (same schema as ORACLE_USER), or as a DBA creating
-- objects in that schema. Safe to re-run: skips CREATE if the table exists (ORA-00955), then
-- adds CREATED_AT / UPDATED_AT only when missing (for upgrades from older DDL).
--
-- Alternatively, enable MONITORING_AUTO_DDL in backend/.env and let the Node backend apply the
-- same definition on startup.
--
-- Columns:
--   SUBJECT    — Memo subject
--   MEMO_NO    — Memo number
--   MEMO_DATE  — Date of the memo
--   THRU       — Routing department (Thru)
--   FOR_DEPT   — Receiving department (For)

SET DEFINE OFF;

--------------------------------------------------------------------------------
-- Create table when absent (full definition including audit columns)
--------------------------------------------------------------------------------

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE MONITORING_OUTGOING (
      ID          NUMBER(18)      PRIMARY KEY,
      SUBJECT     VARCHAR2(2000)  NOT NULL,
      MEMO_NO     VARCHAR2(200)     NOT NULL,
      MEMO_DATE   DATE              NOT NULL,
      THRU        VARCHAR2(100)     NOT NULL,
      FOR_DEPT    VARCHAR2(100)     NOT NULL,
      IS_DELETED  NUMBER(1)         DEFAULT 0 NOT NULL,
      CREATED_AT  TIMESTAMP         DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT  TIMESTAMP         DEFAULT SYSTIMESTAMP NOT NULL
    )
  ]';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -955 THEN
      RAISE;
    END IF;
END;
/

--------------------------------------------------------------------------------
-- Upgrade: add columns if missing (safe to re-run on existing tables)
--------------------------------------------------------------------------------

DECLARE
  c NUMBER;
BEGIN
  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_OUTGOING' AND column_name = 'CREATED_AT';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_OUTGOING ADD (CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_OUTGOING' AND column_name = 'UPDATED_AT';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_OUTGOING ADD (UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_OUTGOING' AND column_name = 'IS_DELETED';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_OUTGOING ADD (IS_DELETED NUMBER(1) DEFAULT 0 NOT NULL)]';
  END IF;
END;
/
