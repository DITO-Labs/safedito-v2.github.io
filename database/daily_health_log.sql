CREATE TABLE `safedito_db`.`daily_health_logs` (
  `dlog_id` INT NOT NULL AUTO_INCREMENT,
  `emp_id` VARCHAR(15) NOT NULL,
  `timestamp` DATETIME NULL DEFAULT NOW(),
  `isValid` TINYINT NULL DEFAULT 1,
  `status` SMALLINT NULL,
  `details` VARCHAR(100) NULL,
  PRIMARY KEY (`dlog_id`, `emp_id`));
