CREATE TABLE `demarrage_serveur` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`build` varchar(64) NOT NULL,
	`version_node` varchar(20) NOT NULL,
	`demarre_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `demarrage_serveur_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_sortant` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` enum('nouvelle_demande','alerte_securite','invitation','test') NOT NULL,
	`destinataire` varchar(254) NOT NULL,
	`sujet` varchar(200) NOT NULL,
	`texte` text NOT NULL,
	`html` text,
	`statut` enum('en_attente','envoye','echec') NOT NULL DEFAULT 'en_attente',
	`tentatives` int unsigned NOT NULL DEFAULT 0,
	`prochaine_tentative_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`derniere_erreur` varchar(200),
	`cree_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`envoye_le` datetime(3),
	CONSTRAINT `email_sortant_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tache_execution` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tache` varchar(40) NOT NULL,
	`declencheur` enum('cron','minuteur','manuel') NOT NULL,
	`statut` enum('en_cours','ok','echec') NOT NULL DEFAULT 'en_cours',
	`debut_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`fin_le` datetime(3),
	`detail` varchar(500),
	CONSTRAINT `tache_execution_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `demarrage_serveur_demarre` ON `demarrage_serveur` (`demarre_le`);--> statement-breakpoint
CREATE INDEX `email_sortant_statut_prochaine` ON `email_sortant` (`statut`,`prochaine_tentative_le`);--> statement-breakpoint
CREATE INDEX `tache_execution_tache_debut` ON `tache_execution` (`tache`,`debut_le`);