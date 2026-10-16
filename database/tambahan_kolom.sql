ALTER TABLE `mitra_profiles` 
ADD COLUMN `description` TEXT NULL AFTER `started_year`,
ADD COLUMN `website` VARCHAR(255) NULL AFTER `description`,
ADD COLUMN `instagram` VARCHAR(100) NULL AFTER `website`,
ADD COLUMN `banner_url` VARCHAR(500) NULL AFTER `instagram`;