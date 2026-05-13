-- MONITORING_PROJECTS — project contract monitoring (ISSD monitoring tools backend)
--
-- Run this script as the app Oracle user (same schema as ORACLE_USER), or as a DBA creating
-- objects in that schema. Safe to re-run: skips CREATE if the table exists (ORA-00955), then
-- adds CREATED_AT / UPDATED_AT only when missing (for upgrades from older DDL).
--
-- Alternatively, enable MONITORING_AUTO_DDL in backend/.env and let the Node backend apply the
-- same definition on startup.

SET DEFINE OFF;

--------------------------------------------------------------------------------
-- Create table when absent (full definition including audit columns)
--------------------------------------------------------------------------------

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE MONITORING_PROJECTS (
      ID              NUMBER(18)      PRIMARY KEY,
      CONTRACT_NAME   VARCHAR2(500)   NOT NULL,
      CONTRACT_DATE   DATE            NOT NULL,
      DURATION        VARCHAR2(200)   NOT NULL,
      GOODS           VARCHAR2(200)   NOT NULL,
      AMOUNT          NUMBER(18, 2)   NOT NULL,
      OUTSTANDING     NUMBER(18, 2)   NOT NULL,
      CREATED_AT      TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT      TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL
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
-- Upgrade: add audit columns if the table predates CREATED_AT / UPDATED_AT
--------------------------------------------------------------------------------

DECLARE
  c NUMBER;
BEGIN
  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_PROJECTS' AND column_name = 'CREATED_AT';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_PROJECTS ADD (CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_PROJECTS' AND column_name = 'UPDATED_AT';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_PROJECTS ADD (UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)]';
  END IF;
END;
/
