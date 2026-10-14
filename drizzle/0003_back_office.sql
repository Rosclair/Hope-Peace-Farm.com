CREATE TABLE `compte` (
	`id` varchar(64) NOT NULL,
	`compte_id` varchar(254) NOT NULL,
	`fournisseur` varchar(40) NOT NULL,
	`utilisateur_id` varchar(64) NOT NULL,
	`jeton_acces` text,
	`jeton_rafraichissement` text,
	`jeton_identite` text,
	`jeton_acces_expire_le` datetime(3),
	`jeton_rafraichissement_expire_le` datetime(3),
	`portee` varchar(500),
	`mot_de_passe` varchar(255),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`maj_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `compte_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deux_facteurs` (
	`id` varchar(64) NOT NULL,
	`secret` varchar(255) NOT NULL,
	`codes_secours` text NOT NULL,
	`utilisateur_id` varchar(64) NOT NULL,
	`verifie` boolean NOT NULL DEFAULT true,
	`echecs` int unsigned NOT NULL DEFAULT 0,
	`verrouille_jusqua` datetime(3),
	CONSTRAINT `deux_facteurs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` varchar(64) NOT NULL,
	`email` varchar(254) NOT NULL,
	`nom` varchar(100) NOT NULL,
	`role` enum('proprietaire','equipe') NOT NULL DEFAULT 'equipe',
	`jeton_empreinte` varchar(64) NOT NULL,
	`expire_le` datetime(3) NOT NULL,
	`cree_par` varchar(64) NOT NULL,
	`acceptee_le` datetime(3),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `invitation_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitation_jeton` UNIQUE(`jeton_empreinte`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(64) NOT NULL,
	`jeton` varchar(128) NOT NULL,
	`utilisateur_id` varchar(64) NOT NULL,
	`expire_le` datetime(3) NOT NULL,
	`empreinte_ip` varchar(64),
	`appareil` varchar(80),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`maj_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_jeton` UNIQUE(`jeton`)
);
--> statement-breakpoint
CREATE TABLE `utilisateur` (
	`id` varchar(64) NOT NULL,
	`nom` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_verifie` boolean NOT NULL DEFAULT false,
	`image` varchar(500),
	`role` enum('proprietaire','equipe') NOT NULL DEFAULT 'equipe',
	`actif` boolean NOT NULL DEFAULT true,
	`deux_facteurs_active` boolean NOT NULL DEFAULT false,
	`echecs_connexion` int unsigned NOT NULL DEFAULT 0,
	`verrouille_jusqua` datetime(3),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`maj_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `utilisateur_id` PRIMARY KEY(`id`),
	CONSTRAINT `utilisateur_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(64) NOT NULL,
	`identifiant` varchar(255) NOT NULL,
	`valeur` text NOT NULL,
	`expire_le` datetime(3) NOT NULL,
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`maj_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_audit` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`utilisateur_id` varchar(64),
	`action` varchar(60) NOT NULL,
	`cible_type` varchar(40),
	`cible_id` varchar(120),
	`avant` json,
	`apres` json,
	`empreinte_ip` varchar(64),
	CONSTRAINT `journal_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reglage` (
	`cle` varchar(60) NOT NULL,
	`valeur` json NOT NULL,
	`modifie_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`modifie_par` varchar(64),
	CONSTRAINT `reglage_cle` PRIMARY KEY(`cle`)
);
--> statement-breakpoint
ALTER TABLE `compte` ADD CONSTRAINT `compte_utilisateur_id_utilisateur_id_fk` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deux_facteurs` ADD CONSTRAINT `deux_facteurs_utilisateur_id_utilisateur_id_fk` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_utilisateur_id_utilisateur_id_fk` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `compte_utilisateur` ON `compte` (`utilisateur_id`);--> statement-breakpoint
CREATE INDEX `deux_facteurs_utilisateur` ON `deux_facteurs` (`utilisateur_id`);--> statement-breakpoint
CREATE INDEX `deux_facteurs_secret` ON `deux_facteurs` (`secret`);--> statement-breakpoint
CREATE INDEX `session_utilisateur` ON `session` (`utilisateur_id`);--> statement-breakpoint
CREATE INDEX `verification_identifiant` ON `verification` (`identifiant`);--> statement-breakpoint
CREATE INDEX `journal_audit_le` ON `journal_audit` (`le`);--> statement-breakpoint
CREATE INDEX `journal_audit_utilisateur` ON `journal_audit` (`utilisateur_id`,`le`);--> statement-breakpoint
CREATE INDEX `journal_audit_action` ON `journal_audit` (`action`,`le`);