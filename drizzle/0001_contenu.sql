CREATE TABLE `contenu_brouillon` (
	`id` tinyint unsigned NOT NULL,
	`donnees` json NOT NULL,
	`a_confirmer` json NOT NULL,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`modifie_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`modifie_par` varchar(120) NOT NULL,
	CONSTRAINT `contenu_brouillon_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `etat_publication` (
	`id` tinyint unsigned NOT NULL,
	`version_en_ligne` int unsigned NOT NULL,
	`modifie_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `etat_publication_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `version_contenu` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`numero` int unsigned NOT NULL,
	`donnees` json NOT NULL,
	`a_confirmer` json NOT NULL,
	`empreinte` char(64) NOT NULL,
	`publie_le` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`publie_par` varchar(120) NOT NULL,
	`restauree_depuis` int unsigned,
	`note` varchar(200),
	CONSTRAINT `version_contenu_id` PRIMARY KEY(`id`),
	CONSTRAINT `version_contenu_numero` UNIQUE(`numero`)
);
