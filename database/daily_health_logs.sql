CREATE TABLE `safedito_db`.`daily_health_logs` (
  `dlog_id` INT NOT NULL AUTO_INCREMENT,
  `emp_id` VARCHAR(15) NOT NULL,
  `dlog_dt` DATETIME NULL,
  `isValid` TINYINT NULL DEFAULT 1,
  `status` SMALLINT NULL,
  `work_cond` SMALLINT NULL,
  `details` VARCHAR(100) NULL,
  PRIMARY KEY (`dlog_id`, `emp_id`));

-- gcloud sql instances patch [INSTANCE_NAME] --database-flags log_bin_trust_function_creators=on

CREATE TRIGGER tr_ BEFORE INSERT ON `daily_health_logs`
    FOR EACH ROW SET NEW.dlog_dt = IFNULL(NEW.dlog_dt,  CONVERT_TZ(now(),'GMT','+08:00'));
    