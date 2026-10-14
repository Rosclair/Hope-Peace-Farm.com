CREATE TABLE `demande` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference` char(16) NOT NULL,
	`type` enum('ceremonie','poulets','pro') NOT NULL,
	`statut` enum('nouvelle','contactee','devis_envoye','acompte_recu','en_preparation','livree','perdue') NOT NULL DEFAULT 'nouvelle',
	`nom` varchar(100) NOT NULL,
	`whatsapp_e164` varchar(16) NOT NULL,
	`reponses` json NOT NULL,
	`message` text NOT NULL,
	`consentement_contact_le` datetime(3) NOT NULL,
	`consentement_version` varchar(20) NOT NULL,
	`annonces` boolean NOT NULL DEFAULT false,
	`source_code` varchar(32),
	`utm_source` varchar(100),
	`utm_medium` varchar(100),
	`utm_campaign` varchar(100),
	`referent_domaine` varchar(253),
	`mode_envoi` enum('js','sans_js') NOT NULL,
	`cle_envoi` varchar(40),
	`statut_change_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`maj_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `demande_id` PRIMARY KEY(`id`),
	CONSTRAINT `demande_reference` UNIQUE(`reference`),
	CONSTRAINT `demande_cle_envoi` UNIQUE(`cle_envoi`)
);
--> statement-breakpoint
CREATE TABLE `demande_evenement` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`demande_id` bigint unsigned NOT NULL,
	`type` enum('creation','statut','note','contact_whatsapp','correction') NOT NULL,
	`de_statut` enum('nouvelle','contactee','devis_envoye','acompte_recu','en_preparation','livree','perdue'),
	`vers_statut` enum('nouvelle','contactee','devis_envoye','acompte_recu','en_preparation','livree','perdue'),
	`texte` text,
	`utilisateur_id` varchar(64),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `demande_evenement_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `limite_debit` (
	`cle` varchar(64) NOT NULL,
	`fenetre_debut` datetime(3) NOT NULL,
	`compteur` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `limite_debit_pk` PRIMARY KEY(`cle`,`fenetre_debut`)
);
--> statement-breakpoint
ALTER TABLE `email_sortant` ADD `demande_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `demande_evenement` ADD CONSTRAINT `demande_evenement_demande_id_demande_id_fk` FOREIGN KEY (`demande_id`) REFERENCES `demande`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `demande_statut` ON `demande` (`statut`);--> statement-breakpoint
CREATE INDEX `demande_type` ON `demande` (`type`);--> statement-breakpoint
CREATE INDEX `demande_cree` ON `demande` (`cree_le`);--> statement-breakpoint
CREATE INDEX `demande_whatsapp` ON `demande` (`whatsapp_e164`);--> statement-breakpoint
CREATE INDEX `demande_source` ON `demande` (`source_code`);--> statement-breakpoint
CREATE INDEX `demande_maj` ON `demande` (`maj_le`);--> statement-breakpoint
CREATE INDEX `demande_evenement_demande` ON `demande_evenement` (`demande_id`,`cree_le`);--> statement-breakpoint
CREATE INDEX `limite_debit_fenetre` ON `limite_debit` (`fenetre_debut`);--> statement-breakpoint
ALTER TABLE `email_sortant` ADD CONSTRAINT `email_sortant_demande_id_demande_id_fk` FOREIGN KEY (`demande_id`) REFERENCES `demande`(`id`) ON DELETE cascade ON UPDATE no action;