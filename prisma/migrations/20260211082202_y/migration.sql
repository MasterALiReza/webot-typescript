/*
  Warnings:

  - You are about to drop the column `is_active` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `enabled` on the `affiliate_settings` table. All the data in the column will be lost.
  - You are about to drop the column `min_withdraw` on the `affiliate_settings` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `bot_settings` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `bot_settings` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `bot_settings` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `bot_texts` table. All the data in the column will be lost.
  - You are about to drop the column `chat_id` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `is_mandatory` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `discount_amount` on the `discount_codes` table. All the data in the column will be lost.
  - You are about to drop the column `discount_percent` on the `discount_codes` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `help_items` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `help_items` table. All the data in the column will be lost.
  - The values [EXPIRED,DEACTIVE] on the enum `invoices_status` will be removed. If these variants are still used in the database, this will fail.
  - The values [CHAT_ID,UUID] on the enum `panels_method_username` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `gateway` on the `payment_reports` table. All the data in the column will be lost.
  - You are about to drop the column `receipt_path` on the `payment_reports` table. All the data in the column will be lost.
  - The values [COMPLETED] on the enum `payment_reports_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `is_enabled` on the `protocols` table. All the data in the column will be lost.
  - You are about to drop the column `admin_reply` on the `support_tickets` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `support_tickets` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `support_tickets` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[order_id]` on the table `payment_reports` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `link` to the `channels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `percent` to the `discount_codes` table without a default value. This is not possible if the table is not empty.
  - Made the column `max_uses` on table `discount_codes` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `method` to the `payment_reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_id` to the `payment_reports` table without a default value. This is not possible if the table is not empty.
  - Made the column `step` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `processing_value` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `processing_value_one` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `processing_value_two` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `processing_value_three` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `processing_value_four` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX `bot_settings_key_key` ON `bot_settings`;

-- DropIndex
DROP INDEX `channels_chat_id_key` ON `channels`;

-- AlterTable
ALTER TABLE `admins` DROP COLUMN `is_active`,
    DROP COLUMN `username`,
    MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'SALES', 'SUPPORT') NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE `affiliate_settings` DROP COLUMN `enabled`,
    DROP COLUMN `min_withdraw`,
    ADD COLUMN `discount_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `discount_percent` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `is_enabled` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `reward_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `bot_settings` DROP COLUMN `key`,
    DROP COLUMN `updated_at`,
    DROP COLUMN `value`,
    ADD COLUMN `aqaye_pardakht_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `bot_status` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `card_number` VARCHAR(50) NULL,
    ADD COLUMN `card_to_card_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `digipay_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `help_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `iran_only_phone` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `message_limit_per_min` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `nowpayments_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `phone_required` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `remove_days_after_exp` INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN `report_channel_id` VARCHAR(100) NULL,
    ADD COLUMN `rules_required` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `test_account_limit` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `verify_required` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `bot_texts` DROP COLUMN `created_at`;

-- AlterTable
ALTER TABLE `channels` DROP COLUMN `chat_id`,
    DROP COLUMN `created_at`,
    DROP COLUMN `is_mandatory`,
    DROP COLUMN `title`,
    DROP COLUMN `username`,
    ADD COLUMN `link` VARCHAR(200) NOT NULL;

-- AlterTable
ALTER TABLE `discount_codes` DROP COLUMN `discount_amount`,
    DROP COLUMN `discount_percent`,
    ADD COLUMN `percent` INTEGER NOT NULL,
    MODIFY `code` VARCHAR(100) NOT NULL,
    MODIFY `max_uses` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `help_items` DROP COLUMN `created_at`,
    DROP COLUMN `order`,
    ADD COLUMN `file_id` VARCHAR(500) NULL,
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `invoices` MODIFY `status` ENUM('PENDING', 'ACTIVE', 'END_OF_TIME', 'END_OF_VOLUME', 'SENDEDWARN', 'WARNED', 'DISABLED', 'REMOVED', 'REMOVE_TIME') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `panels` ADD COLUMN `date_login` TEXT NULL,
    MODIFY `method_username` ENUM('RANDOM', 'CUSTOM_RANDOM', 'CUSTOM_ONLY', 'CHAT_ID_RANDOM', 'CHAT_ID_ONLY') NOT NULL DEFAULT 'RANDOM';

-- AlterTable
ALTER TABLE `payment_reports` DROP COLUMN `gateway`,
    DROP COLUMN `receipt_path`,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `method` ENUM('CARD_TO_CARD', 'NOWPAYMENTS', 'AQAYE_PARDAKHT', 'DIGI_PAY') NOT NULL,
    ADD COLUMN `order_id` VARCHAR(100) NOT NULL,
    ADD COLUMN `photo_id` VARCHAR(500) NULL,
    MODIFY `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `protocols` DROP COLUMN `is_enabled`,
    MODIFY `name` VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE `support_tickets` DROP COLUMN `admin_reply`,
    DROP COLUMN `subject`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `response` TEXT NULL,
    MODIFY `status` ENUM('OPEN', 'ANSWERED', 'CLOSED') NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `limit_user_test` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `phone_number` VARCHAR(20) NULL,
    ADD COLUMN `roll_accepted` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `step` VARCHAR(100) NOT NULL DEFAULT 'home',
    MODIFY `processing_value` VARCHAR(500) NOT NULL DEFAULT '0',
    MODIFY `processing_value_one` VARCHAR(500) NOT NULL DEFAULT '0',
    MODIFY `processing_value_two` VARCHAR(500) NOT NULL DEFAULT '0',
    MODIFY `processing_value_three` VARCHAR(500) NOT NULL DEFAULT '0',
    MODIFY `processing_value_four` VARCHAR(100) NOT NULL DEFAULT '0';

-- CreateIndex
CREATE UNIQUE INDEX `payment_reports_order_id_key` ON `payment_reports`(`order_id`);
