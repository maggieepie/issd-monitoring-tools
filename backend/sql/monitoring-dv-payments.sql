-- MONITORING_DV_PAYMENTS — DV payment monitoring (ISSD monitoring tools backend)
--
-- Run this script as the app Oracle user (same schema as ORACLE_USER), or as a DBA creating
-- objects in that schema. Safe to re-run: skips CREATE if the table exists (ORA-00955), then
-- adds CREATED_AT / UPDATED_AT only when missing (for upgrades from older DDL).
--
-- Alternatively, enable MONITORING_AUTO_DDL in backend/.env and let the Node backend apply the
-- same definition on startup.
--
-- Columns:
--   TITLE            — Title of the Project
--   CLAIMANT_ADDRESS — Name and Address of Claimant
--   VOUCHER_NO       — Disbursement Voucher number
--   VOUCHER_DATE     — Date of the voucher
--   AMOUNT           — Total voucher amount
--   ICTSSD           — ITMG department status  (e.g. Pending / Signed)
--   GAD              — GAD status     (e.g. Pending / Signed)
--   CASH             — Cash status    (e.g. Pending / Signed)
--   *_PENDING_SINCE  — When each department status entered Pending (for elapsed tracking)

SET DEFINE OFF;

--------------------------------------------------------------------------------
-- Create table when absent (full definition including audit columns)
--------------------------------------------------------------------------------

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE MONITORING_DV_PAYMENTS (
      ID               NUMBER(18)      PRIMARY KEY,
      TITLE            VARCHAR2(500)   NOT NULL,
      CLAIMANT_ADDRESS VARCHAR2(500)   NOT NULL,
      VOUCHER_NO       VARCHAR2(200)   NOT NULL,
      VOUCHER_DATE     DATE            NOT NULL,
      AMOUNT           NUMBER(18, 2)   DEFAULT 0 NOT NULL,
      ICTSSD           VARCHAR2(100)   DEFAULT 'Pending' NOT NULL,
      GAD              VARCHAR2(100)   DEFAULT 'Pending' NOT NULL,
      CASH             VARCHAR2(100)   DEFAULT 'Pending' NOT NULL,
      ICTSSD_PENDING_SINCE TIMESTAMP,
      GAD_PENDING_SINCE    TIMESTAMP,
      CASH_PENDING_SINCE   TIMESTAMP,
      IS_DELETED       NUMBER(1)       DEFAULT 0 NOT NULL,
      CREATED_AT       TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT       TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL
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
   WHERE table_name = 'MONITORING_DV_PAYMENTS' AND column_name = 'CREATED_AT';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_DV_PAYMENTS ADD (CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_DV_PAYMENTS' AND column_name = 'UPDATED_AT';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_DV_PAYMENTS ADD (UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_DV_PAYMENTS' AND column_name = 'IS_DELETED';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_DV_PAYMENTS ADD (IS_DELETED NUMBER(1) DEFAULT 0 NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_DV_PAYMENTS' AND column_name = 'ICTSSD_PENDING_SINCE';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_DV_PAYMENTS ADD (ICTSSD_PENDING_SINCE TIMESTAMP)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_DV_PAYMENTS' AND column_name = 'GAD_PENDING_SINCE';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_DV_PAYMENTS ADD (GAD_PENDING_SINCE TIMESTAMP)]';
  END IF;

  SELECT COUNT(*) INTO c FROM user_tab_columns
   WHERE table_name = 'MONITORING_DV_PAYMENTS' AND column_name = 'CASH_PENDING_SINCE';
  IF c = 0 THEN
    EXECUTE IMMEDIATE
      q'[ALTER TABLE MONITORING_DV_PAYMENTS ADD (CASH_PENDING_SINCE TIMESTAMP)]';
  END IF;
END;
/

UPDATE MONITORING_DV_PAYMENTS
   SET ICTSSD_PENDING_SINCE = CREATED_AT
 WHERE ICTSSD = 'Pending'
   AND ICTSSD_PENDING_SINCE IS NULL
   AND (IS_DELETED = 0 OR IS_DELETED IS NULL);

UPDATE MONITORING_DV_PAYMENTS
   SET GAD_PENDING_SINCE = CREATED_AT
 WHERE GAD = 'Pending'
   AND GAD_PENDING_SINCE IS NULL
   AND (IS_DELETED = 0 OR IS_DELETED IS NULL);

UPDATE MONITORING_DV_PAYMENTS
   SET CASH_PENDING_SINCE = CREATED_AT
 WHERE CASH = 'Pending'
   AND CASH_PENDING_SINCE IS NULL
   AND (IS_DELETED = 0 OR IS_DELETED IS NULL);
