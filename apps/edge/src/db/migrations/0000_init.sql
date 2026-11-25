CREATE TABLE `ai_keys` (
	`org_id` text NOT NULL,
	`provider` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`last4` text NOT NULL,
	PRIMARY KEY(`org_id`, `provider`),
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`day` text NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `org_id`, `user_id`, `provider`, `model`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`actor_id` text,
	`action` text NOT NULL,
	`target` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_org_idx` ON `audit_log` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_log` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`ai_key_delegated` integer DEFAULT false NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`org_id`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memberships_role_ck" CHECK("memberships"."role" IN ('admin', 'executive', 'member', 'viewer')),
	CONSTRAINT "memberships_status_ck" CHECK("memberships"."status" IN ('active', 'removed')),
	CONSTRAINT "memberships_delegation_ck" CHECK("memberships"."ai_key_delegated" = 0 OR "memberships"."role" = 'executive')
);
--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `memberships_org_idx` ON `memberships` (`org_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_one_admin_per_org` ON `memberships` (`org_id`) WHERE role = 'admin' AND status = 'active';--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `role_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`role` text NOT NULL,
	`key_hash` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "role_keys_role_ck" CHECK("role_keys"."role" IN ('member', 'viewer')),
	CONSTRAINT "role_keys_uses_ck" CHECK("role_keys"."max_uses" >= 1 AND "role_keys"."uses" >= 0 AND "role_keys"."uses" <= "role_keys"."max_uses")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_keys_hash_uq` ON `role_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `role_keys_org_idx` ON `role_keys` (`org_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `snapshot_data` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`data` blob NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "snapshot_data_size_ck" CHECK(length("snapshot_data"."data") <= 1800000)
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`bytes` integer NOT NULL,
	`title` text,
	`summary` text,
	`summary_status` text DEFAULT 'none' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "snapshots_kind_ck" CHECK("snapshots"."kind" IN ('auto', 'named', 'pre_restore')),
	CONSTRAINT "snapshots_summary_status_ck" CHECK("snapshots"."summary_status" IN ('none', 'pending', 'done', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `snapshots_ws_idx` ON `snapshots` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `upload_data` (
	`upload_id` text PRIMARY KEY NOT NULL,
	`data` blob NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "upload_data_size_ck" CHECK(length("upload_data"."data") <= 1800000)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "uploads_visibility_ck" CHECK("uploads"."visibility" IN ('private', 'published'))
);
--> statement-breakpoint
CREATE INDEX `uploads_ws_idx` ON `uploads` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`picture` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_uq` ON `users` (`google_sub`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`owner_user_id` text,
	`org_id` text,
	`kind` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspaces_scope_ck" CHECK(("workspaces"."scope" = 'personal' AND "workspaces"."owner_user_id" IS NOT NULL AND "workspaces"."org_id" IS NULL)
       OR ("workspaces"."scope" = 'organisation' AND "workspaces"."org_id" IS NOT NULL AND "workspaces"."owner_user_id" IS NULL)),
	CONSTRAINT "workspaces_kind_ck" CHECK("workspaces"."kind" IN ('draft', 'canvas'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_one_public_per_org` ON `workspaces` (`org_id`) WHERE scope = 'organisation';--> statement-breakpoint
CREATE INDEX `workspaces_owner_idx` ON `workspaces` (`owner_user_id`);