-- Optional: the Node backend can create this table on startup (see MONITORING_AUTO_DDL in backend/.env.example).
-- Or run this script manually once while connected as the app Oracle user.

CREATE TABLE MONITORING_PROJECTS (
  ID              NUMBER(18)      PRIMARY KEY,
  CONTRACT_NAME   VARCHAR2(500)   NOT NULL,
  CONTRACT_DATE   DATE            NOT NULL,
  DURATION        VARCHAR2(200)   NOT NULL,
  GOODS           VARCHAR2(200)   NOT NULL,
  AMOUNT          NUMBER(18, 2)   NOT NULL,
  OUTSTANDING     NUMBER(18, 2)   NOT NULL
);
