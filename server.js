/**
 * server.js — Blind Quizz · Serveur de jeu en temps réel
 * Zéro dépendance (Node.js natif uniquement)
 * Lancer : node server.js
 * Accès animateur : http://localhost:3000          (index.html)
 * Accès capitaine : http://localhost:3000/joueur   (depuis le smartphone)
 *
 * Le serveur fait autorité : questions, tirage, réponses et scoring.
 * Les bonnes réponses ne sont jamais envoyées aux téléphones, ni à l'écran
 * animateur pendant la phase de réponses.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ======================================================================
// QUESTIONS (100 par banque — exactement 10 par chiffre de 0 à 9)
// Le questionnaire est choisi par l'animateur sur l'écran de configuration
// (voir QUESTION_BANKS plus bas).
// ======================================================================

const QUESTIONS_CLASSIQUES = [
  // ── 0 ──
  { text: 'Combien de pattes possède un serpent ?', answer: 0 },
  { text: 'Combien de lunes naturelles possède la planète Vénus ?', answer: 0 },
  { text: 'Combien de lunes naturelles possède la planète Mercure ?', answer: 0 },
  { text: 'Combien de cornes possède un cheval ?', answer: 0 },
  { text: 'À combien de degrés Celsius la glace fond-elle (pression normale) ?', answer: 0 },
  { text: 'Combien d\'os possède une pieuvre ?', answer: 0, explanation: 'La pieuvre est un mollusque sans squelette.' },
  { text: 'Quelle est la latitude de l\'équateur, en degrés ?', answer: 0 },
  { text: 'Quelle est la longitude du méridien de Greenwich, en degrés ?', answer: 0 },
  { text: 'Combien de dents possède une poule ?', answer: 0, explanation: 'Les oiseaux actuels n\'ont pas de dents.' },
  { text: 'Combien de pattes possède un ver de terre ?', answer: 0 },

  // ── 1 ──
  { text: 'Combien de lunes naturelles possède la Terre ?', answer: 1 },
  { text: 'Combien de bosses possède un dromadaire ?', answer: 1 },
  { text: 'Combien de cœurs possède un être humain ?', answer: 1 },
  { text: 'Combien de cornes possède une licorne ?', answer: 1 },
  { text: 'Quel est le numéro atomique de l\'hydrogène ?', answer: 1 },
  { text: 'Au football, combien de gardiens de but chaque équipe a-t-elle sur le terrain ?', answer: 1 },
  { text: 'Combien de faces possède un ruban de Möbius ?', answer: 1, explanation: 'Le ruban de Möbius n\'a qu\'une seule face.' },
  { text: 'Combien de roues possède un monocycle ?', answer: 1 },
  { text: 'Dans la mythologie grecque, combien d\'yeux possède un cyclope ?', answer: 1 },
  { text: 'Combien d\'étoiles se trouvent au centre de notre système solaire ?', answer: 1, explanation: 'Le Soleil.' },

  // ── 2 ──
  { text: 'Combien de lunes naturelles possède la planète Mars ?', answer: 2, explanation: 'Phobos et Deimos.' },
  { text: 'Combien de bosses possède un chameau ?', answer: 2 },
  { text: 'Quel est le plus petit nombre premier ?', answer: 2 },
  { text: 'Combien de reins possède un être humain ?', answer: 2 },
  { text: 'Combien de roues possède un vélo classique ?', answer: 2 },
  { text: 'Quel est le numéro atomique de l\'hélium ?', answer: 2 },
  { text: 'Combien de joueurs s\'affrontent dans un match de tennis en simple ?', answer: 2 },
  { text: 'Combien d\'ailes possède une mouche ?', answer: 2, explanation: 'Les mouches sont des diptères : « deux ailes ».' },
  { text: 'Combien de chromosomes sexuels possède un être humain ?', answer: 2, explanation: 'XX ou XY.' },
  { text: 'En combien d\'hémisphères le cerveau humain est-il divisé ?', answer: 2 },

  // ── 3 ──
  { text: 'Combien de cœurs possède une pieuvre ?', answer: 3 },
  { text: 'Combien de côtés possède un triangle ?', answer: 3 },
  { text: 'Combien de couleurs figurent sur le drapeau français ?', answer: 3 },
  { text: 'Combien de mousquetaires figurent dans le titre du roman d\'Alexandre Dumas ?', answer: 3 },
  { text: 'Combien d\'osselets se trouvent dans l\'oreille moyenne humaine ?', answer: 3, explanation: 'Le marteau, l\'enclume et l\'étrier.' },
  { text: 'Au rugby à XV, combien de points rapporte une pénalité réussie ?', answer: 3 },
  { text: 'À quel rang se trouve la Terre en partant du Soleil ?', answer: 3 },
  { text: 'Combien de paires de pattes possède un insecte ?', answer: 3 },
  { text: 'Combien de petits cochons y a-t-il dans le célèbre conte ?', answer: 3 },
  { text: 'Quel est le numéro atomique du lithium ?', answer: 3 },

  // ── 4 ──
  { text: 'Combien de cordes possède un violon ?', answer: 4 },
  { text: 'Combien de cavités (oreillettes et ventricules) compte le cœur humain ?', answer: 4 },
  { text: 'Combien de membres composaient les Beatles ?', answer: 4 },
  { text: 'Combien de lunes de Jupiter sont dites « galiléennes » ?', answer: 4, explanation: 'Io, Europe, Ganymède et Callisto.' },
  { text: 'Combien de pattes possède un chien ?', answer: 4 },
  { text: 'Combien de faces possède un tétraèdre ?', answer: 4 },
  { text: 'Combien de bases azotées différentes composent l\'ADN ?', answer: 4, explanation: 'A, T, G et C.' },
  { text: 'Combien de poches compte l\'estomac d\'une vache ?', answer: 4, explanation: 'Panse, bonnet, feuillet et caillette.' },
  { text: 'Combien d\'années séparent deux Jeux olympiques d\'été ?', answer: 4 },
  { text: 'Combien de couleurs (enseignes) compte un jeu de 52 cartes ?', answer: 4, explanation: 'Pique, cœur, carreau et trèfle.' },

  // ── 5 ──
  { text: 'Combien d\'anneaux figurent sur le drapeau olympique ?', answer: 5 },
  { text: 'Combien de doigts compte une main humaine ?', answer: 5 },
  { text: 'Combien de sens l\'être humain possède-t-il traditionnellement ?', answer: 5 },
  { text: 'Combien de côtés possède un pentagone ?', answer: 5 },
  { text: 'Au basket-ball, combien de joueurs par équipe sont sur le terrain ?', answer: 5 },
  { text: 'Quel est le numéro atomique du bore ?', answer: 5 },
  { text: 'Combien de lignes compte une portée musicale ?', answer: 5 },
  { text: 'Combien de faces possède une pyramide à base carrée ?', answer: 5 },
  { text: 'Combien de membres permanents compte le Conseil de sécurité de l\'ONU ?', answer: 5 },
  { text: 'Combien d\'orteils compte un pied humain ?', answer: 5 },

  // ── 6 ──
  { text: 'Combien de pattes possède un insecte ?', answer: 6 },
  { text: 'Combien de faces possède un dé à jouer classique ?', answer: 6 },
  { text: 'Combien de côtés possède un hexagone ?', answer: 6 },
  { text: 'Combien de cordes possède une guitare classique ?', answer: 6 },
  { text: 'Au hockey sur glace, combien de joueurs par équipe sont sur la glace (gardien compris) ?', answer: 6 },
  { text: 'Quel est le numéro atomique du carbone ?', answer: 6 },
  { text: 'Au volley-ball, combien de joueurs par équipe sont sur le terrain ?', answer: 6 },
  { text: 'Combien d\'arêtes possède un tétraèdre ?', answer: 6 },
  { text: 'Combien de côtés possède une alvéole d\'abeille ?', answer: 6 },
  { text: 'Combien de branches possède un cristal de flocon de neige ?', answer: 6 },

  // ── 7 ──
  { text: 'Combien de jours compte une semaine ?', answer: 7 },
  { text: 'Combien de couleurs compte traditionnellement l\'arc-en-ciel ?', answer: 7 },
  { text: 'Combien de notes différentes compte la gamme de do majeur ?', answer: 7, explanation: 'Do, ré, mi, fa, sol, la, si.' },
  { text: 'Combien de nains accompagnent Blanche-Neige ?', answer: 7 },
  { text: 'Combien de merveilles du monde antique recense-t-on ?', answer: 7 },
  { text: 'Quel est le numéro atomique de l\'azote ?', answer: 7 },
  { text: 'Combien de vertèbres cervicales possède une girafe ?', answer: 7, explanation: 'Autant que l\'être humain, mais beaucoup plus longues !' },
  { text: 'Combien de péchés capitaux recense la tradition chrétienne ?', answer: 7 },
  { text: 'Combien de romans compte la saga principale Harry Potter ?', answer: 7 },
  { text: 'Au handball, combien de joueurs par équipe sont sur le terrain (gardien compris) ?', answer: 7 },

  // ── 8 ──
  { text: 'Combien de pattes possède une araignée ?', answer: 8 },
  { text: 'Combien de bras possède une pieuvre ?', answer: 8 },
  { text: 'Combien de planètes compte le système solaire ?', answer: 8 },
  { text: 'Combien de côtés possède le panneau routier « STOP » ?', answer: 8 },
  { text: 'Quel est le numéro atomique de l\'oxygène ?', answer: 8 },
  { text: 'Combien de bits compte un octet ?', answer: 8 },
  { text: 'Combien de sommets possède un cube ?', answer: 8 },
  { text: 'Aux échecs, combien de pions possède chaque joueur en début de partie ?', answer: 8 },
  { text: 'Combien de cases compte un côté d\'un échiquier ?', answer: 8 },
  { text: 'En aviron, combien de rameurs (hors barreur) compte un « huit » ?', answer: 8 },

  // ── 9 ──
  { text: 'Au baseball, combien de joueurs par équipe sont sur le terrain en défense ?', answer: 9 },
  { text: 'Combien de Muses compte la mythologie grecque ?', answer: 9 },
  { text: 'Combien de cases compte une grille de morpion ?', answer: 9 },
  { text: 'Combien de mois dure environ une grossesse humaine ?', answer: 9 },
  { text: 'Quel est le numéro atomique du fluor ?', answer: 9 },
  { text: 'Combien de cercles compte l\'Enfer dans la Divine Comédie de Dante ?', answer: 9 },
  { text: 'Combien de membres compte la Communauté de l\'Anneau ?', answer: 9 },
  { text: 'Combien de chiffres différents remplissent une ligne de sudoku ?', answer: 9 },
  { text: 'Quel est le plus grand chiffre en base 10 ?', answer: 9 },
  { text: 'Combien de planètes comptait officiellement le système solaire avant 2006 ?', answer: 9, explanation: 'Pluton a été reclassée planète naine en 2006.' }
];

// Banque « malin » : culture variée, calculs, estimations, énigmes et pièges
const QUESTIONS_MALIGNES = [
  // ── 0 ──
  { text: 'Combien de lettres « e » contient le roman « La Disparition » de Georges Perec ?', answer: 0, explanation: 'Un roman de 300 pages entièrement écrit sans la lettre e (lipogramme).' },
  { text: 'Combien de notes le pianiste joue-t-il dans le morceau « 4′33″ » de John Cage ?', answer: 0, explanation: '4 minutes 33 secondes de silence : la « musique », ce sont les bruits de la salle.' },
  { text: 'Que vaut le produit de tous les chiffres de 0 à 9 (0 × 1 × 2 × … × 9) ?', answer: 0, explanation: 'Il suffit d\'un zéro pour tout annuler !' },
  { text: 'Combien de fois le Titanic est-il arrivé à New York ?', answer: 0, explanation: 'Il a coulé lors de son voyage inaugural, en avril 1912.' },
  { text: 'Quel est le reste de la division de 1 000 000 par 8 ?', answer: 0, explanation: '1 000 = 8 × 125, donc 1 000 000 est divisible par 8.' },
  { text: 'En Italie, combien de jours se sont écoulés entre le jeudi 4 et le vendredi 15 octobre 1582 ?', answer: 0, explanation: 'Passage au calendrier grégorien : le 15 a directement suivi le 4.' },
  { text: 'Combien de symboles faut-il pour écrire le nombre zéro en chiffres romains ?', answer: 0, explanation: 'Les Romains n\'avaient pas de chiffre pour le zéro.' },
  { text: 'Combien de bras possède la Vénus de Milo ?', answer: 0 },
  { text: 'Combien de capitales officielles possède l\'île-État de Nauru ?', answer: 0, explanation: 'Nauru n\'a pas de capitale officielle ; Yaren abrite le gouvernement.' },
  { text: 'Combien d\'années bissextiles y a-t-il entre 1897 et 1903 inclus ?', answer: 0, explanation: '1900 n\'est pas bissextile : divisible par 100 mais pas par 400.' },

  // ── 1 ──
  { text: 'Combien de fuseaux horaires officiels la Chine utilise-t-elle ?', answer: 1, explanation: 'Un seul (heure de Pékin), malgré 5 000 km d\'est en ouest.' },
  { text: 'Combien de lettres compte le nom de la commune française au nom le plus court ?', answer: 1, explanation: 'Y, dans la Somme. Ses habitants sont les Ypsiloniens !' },
  { text: 'Quel est le chiffre des unités de 11 puissance 11 ?', answer: 1, explanation: 'Une puissance d\'un nombre finissant par 1 finit toujours par 1.' },
  { text: 'Que vaut 1 − 1 + 1 − 1 + … si l\'on écrit 2 025 termes ?', answer: 1, explanation: 'Les paires s\'annulent, il reste le dernier « + 1 ».' },
  { text: 'Dans Highlander, il ne peut en rester… combien ?', answer: 1 },
  { text: 'Combien de pays se trouvent entièrement à l\'intérieur de la ville de Rome ?', answer: 1, explanation: 'Le Vatican.' },
  { text: 'Combien d\'yeux possède Stuart, le Minion ?', answer: 1 },
  { text: 'Combien de pays ont un drapeau national qui n\'est pas rectangulaire ?', answer: 1, explanation: 'Le Népal et ses deux triangles superposés.' },
  { text: 'Combien de Ballons d\'or Zinédine Zidane a-t-il remportés ?', answer: 1, explanation: 'En 1998.' },
  { text: 'Combien de buts la France a-t-elle marqués en finale du Mondial 2006 (hors tirs au but) ?', answer: 1, explanation: 'La panenka de Zidane, avant le fameux coup de tête…' },

  // ── 2 ──
  { text: 'Combien de fois par jour la petite aiguille d\'une horloge fait-elle le tour complet du cadran ?', answer: 2, explanation: 'Elle fait un tour en 12 heures, donc 2 tours en 24 heures.' },
  { text: 'Combien de pays au monde sont « doublement enclavés » (entourés uniquement de pays sans accès à la mer) ?', answer: 2, explanation: 'Le Liechtenstein et l\'Ouzbékistan.' },
  { text: 'Un nénuphar double de surface chaque jour et recouvre tout l\'étang en 30 jours. Combien de jours avant la fin l\'étang n\'était-il couvert qu\'au quart ?', answer: 2, explanation: 'Moitié au jour 29, quart au jour 28.' },
  { text: 'Combien de prix Nobel Marie Curie a-t-elle reçus ?', answer: 2, explanation: 'Physique (1903) et chimie (1911).' },
  { text: 'Si une poule et demie pond un œuf et demi en un jour et demi, combien d\'œufs pond une poule en trois jours ?', answer: 2, explanation: 'Une poule pond 1 œuf en 1,5 jour, donc 2 œufs en 3 jours.' },
  { text: 'Combien d\'astronautes de la mission Apollo 11 ont marché sur la Lune ?', answer: 2, explanation: 'Armstrong et Aldrin ; Collins est resté en orbite.' },
  { text: 'Combien de pattes possède un flamant rose qui dort sur une patte ?', answer: 2, explanation: 'Il en replie une, mais il en a toujours deux !' },
  { text: 'Combien de bouteilles classiques (75 cl) contient un magnum ?', answer: 2, explanation: 'Un magnum fait 1,5 litre.' },
  { text: 'Combien vaut le nombre binaire « 10 » en décimal ?', answer: 2 },
  { text: 'Combien de millions d\'habitants compte Paris intra-muros (arrondi) ?', answer: 2, explanation: 'Environ 2,1 millions.' },

  // ── 3 ──
  { text: 'Combien de lettres « r » contient le mot anglais « strawberry » ?', answer: 3, explanation: 'Une question qui a longtemps piégé les intelligences artificielles !' },
  { text: 'Combien d\'enfants ont Homer et Marge Simpson ?', answer: 3, explanation: 'Bart, Lisa et Maggie.' },
  { text: 'Combien de capitales possède l\'Afrique du Sud ?', answer: 3, explanation: 'Pretoria (exécutif), Le Cap (législatif) et Bloemfontein (judiciaire).' },
  { text: 'Que vaut le numéro des pompiers (2 chiffres) moins celui du SAMU ?', answer: 3, explanation: '18 − 15 = 3.' },
  { text: 'Combien de têtes possède Cerbère, le chien gardien des Enfers ?', answer: 3 },
  { text: 'Un œuf à la coque cuit en 3 minutes. Combien de minutes faut-il pour cuire 3 œufs ensemble dans la même casserole ?', answer: 3, explanation: 'Ils cuisent en même temps !' },
  { text: 'Un tiroir contient des chaussettes noires et blanches en vrac. Combien faut-il en piocher au minimum, dans le noir, pour être sûr d\'avoir une paire ?', answer: 3, explanation: 'Avec deux couleurs, la 3e chaussette forme forcément une paire.' },
  { text: 'Combien de titres olympiques sur 100 m Usain Bolt a-t-il remportés ?', answer: 3, explanation: 'Pékin 2008, Londres 2012 et Rio 2016.' },
  { text: 'Combien vaut 111 111 111 ÷ 37 037 037 ?', answer: 3 },
  { text: 'Si 3 chats attrapent 3 souris en 3 minutes, combien de chats faut-il pour attraper 9 souris en 9 minutes ?', answer: 3, explanation: 'Chaque chat attrape une souris toutes les 3 minutes, soit 3 souris en 9 minutes.' },

  // ── 4 ──
  { text: 'Combien de nations constitutives forment le Royaume-Uni ?', answer: 4, explanation: 'Angleterre, Écosse, pays de Galles et Irlande du Nord.' },
  { text: 'En Champagne, combien de bouteilles classiques (75 cl) contient un jéroboam ?', answer: 4, explanation: 'Un jéroboam de champagne fait 3 litres.' },
  { text: 'Combien de mois de l\'année ne contiennent pas la lettre « r » ?', answer: 4, explanation: 'Mai, juin, juillet et août.' },
  { text: 'Quelle est la 2e décimale du nombre π ?', answer: 4, explanation: 'π = 3,14159…' },
  { text: 'Combien de Tortues Ninja combattent le crime à New York ?', answer: 4, explanation: 'Leonardo, Michelangelo, Donatello et Raphael.' },
  { text: 'Combien de fantômes poursuivent Pac-Man dans le jeu original ?', answer: 4, explanation: 'Blinky, Pinky, Inky et Clyde.' },
  { text: 'Combien de couleurs suffisent toujours pour colorier une carte sans que deux pays voisins aient la même couleur ?', answer: 4, explanation: 'Le théorème des quatre couleurs, démontré par ordinateur en 1976.' },
  { text: 'Combien de fois le diamètre de la Terre est-il plus grand que celui de la Lune (arrondi) ?', answer: 4, explanation: '12 742 km contre 3 474 km : environ 3,7.' },
  { text: 'Combien de présidents américains sont sculptés sur le mont Rushmore ?', answer: 4, explanation: 'Washington, Jefferson, Roosevelt et Lincoln.' },
  { text: 'Combien de mois de l\'année comptent exactement 30 jours ?', answer: 4, explanation: 'Avril, juin, septembre et novembre.' },

  // ── 5 ──
  { text: 'Combien de lettres « a » contient le mot « abracadabra » ?', answer: 5 },
  { text: 'Dans « Le Club des Cinq », combien de membres compte la bande… chien compris ?', answer: 5, explanation: 'François, Mick, Annie, Claude… et le chien Dagobert !' },
  { text: 'Quelle est la valeur, en euros, du plus petit billet de banque en euros ?', answer: 5, explanation: 'Le billet de 5 €.' },
  { text: 'Combien de litres de sang circulent dans le corps d\'un adulte (environ) ?', answer: 5 },
  { text: 'Combien de chanteuses composaient les Spice Girls ?', answer: 5 },
  { text: 'Une batte et une balle coûtent 1,10 € ensemble. La batte coûte 1 € de plus que la balle. Combien de centimes coûte la balle ?', answer: 5, explanation: 'Pas 10 ! Balle 0,05 € + batte 1,05 € = 1,10 €.' },
  { text: 'À 60 km/h, combien de minutes faut-il pour parcourir 5 km ?', answer: 5, explanation: '60 km/h, c\'est 1 km par minute.' },
  { text: 'Combien de Tours de France Bernard Hinault a-t-il remportés ?', answer: 5 },
  { text: 'Quelle est la longueur, en mètres, de la diagonale d\'un rectangle de 3 m sur 4 m ?', answer: 5, explanation: 'Pythagore : 3² + 4² = 9 + 16 = 25 = 5².' },
  { text: 'Combien de carrés au total peut-on compter dans une grille de 2 cases sur 2 ?', answer: 5, explanation: '4 petits carrés + le grand carré.' },

  // ── 6 ──
  { text: 'Combien de couleurs différentes trouve-t-on dans un sachet de M&M\'s classique ?', answer: 6, explanation: 'Rouge, orange, jaune, vert, bleu et marron.' },
  { text: 'Combien de couleurs différentes compte un Rubik\'s Cube classique ?', answer: 6 },
  { text: 'Aux échecs, combien de types de pièces différents existe-t-il ?', answer: 6, explanation: 'Roi, dame, tour, fou, cavalier et pion.' },
  { text: 'Combien de personnages principaux compte la série « Friends » ?', answer: 6, explanation: 'Rachel, Monica, Phoebe, Joey, Chandler et Ross.' },
  { text: '4 personnes se serrent toutes la main une fois. Combien de poignées de main au total ?', answer: 6, explanation: '4 × 3 ÷ 2 = 6.' },
  { text: 'Un ballon de foot classique est cousu de pentagones noirs et d\'hexagones blancs. Combien de côtés a chaque pièce blanche ?', answer: 6, explanation: 'Hexagone = 6 côtés (pentagone = 5).' },
  { text: 'Quel est le plus petit nombre parfait (égal à la somme de ses diviseurs, lui-même exclu) ?', answer: 6, explanation: '6 = 1 + 2 + 3.' },
  { text: 'À la boulangerie, combien de croissants recevez-vous si vous en demandez « une demi-douzaine » ?', answer: 6 },
  { text: 'Couper une bûche prend 2 minutes. Combien de minutes faut-il pour la couper en 4 morceaux ?', answer: 6, explanation: 'Il ne faut que 3 coupes : 3 × 2 = 6.' },
  { text: 'Au tarot à 4 joueurs, combien de cartes composent le chien ?', answer: 6, explanation: '78 cartes = 4 × 18 + 6.' },

  // ── 7 ──
  { text: 'Combien de Tours de France ont été retirés à Lance Armstrong ?', answer: 7, explanation: 'Ses 7 victoires de 1999 à 2005, pour dopage.' },
  { text: 'Combien de jours séparent deux lundis consécutifs ?', answer: 7 },
  { text: 'Combien de boules de cristal faut-il réunir dans Dragon Ball ?', answer: 7 },
  { text: 'Quel est le dernier chiffre du matricule de James Bond ?', answer: 7, explanation: '007, permis de tuer.' },
  { text: 'Combien de pièces compose un tangram ?', answer: 7, explanation: '5 triangles, 1 carré et 1 parallélogramme.' },
  { text: 'Selon le dicton français, combien de vies a un chat ?', answer: 7, explanation: 'Les anglophones, eux, lui en accordent 9 !' },
  { text: 'Sur combien de collines Rome a-t-elle été bâtie ?', answer: 7 },
  { text: 'Au Uno, combien de cartes chaque joueur reçoit-il en début de partie ?', answer: 7 },
  { text: 'De combien de lieues sont les bottes de l\'ogre dans « Le Petit Poucet » ?', answer: 7 },
  { text: 'Combien d\'allumettes faut-il pour former deux carrés côte à côte qui partagent un côté ?', answer: 7, explanation: '4 + 3 = 7.' },

  // ── 8 ──
  { text: 'Combien de mois de l\'année contiennent la lettre « r » ?', answer: 8 },
  { text: 'Une famille compte 7 sœurs, et chacune a exactement 1 frère. Combien d\'enfants y a-t-il au total ?', answer: 8, explanation: 'Elles ont toutes le même frère : 7 + 1 = 8.' },
  { text: 'Combien de Ballons d\'or Lionel Messi a-t-il remportés ?', answer: 8 },
  { text: 'Quel nombre vient ensuite : 1, 1, 2, 3, 5, … ?', answer: 8, explanation: 'La suite de Fibonacci : chaque terme est la somme des deux précédents.' },
  { text: 'Combien de pays ont une frontière terrestre avec la France métropolitaine ?', answer: 8, explanation: 'Belgique, Luxembourg, Allemagne, Suisse, Italie, Monaco, Andorre et Espagne.' },
  { text: 'Combien de petits cubes de 1 cm faut-il pour construire un cube de 2 cm de côté ?', answer: 8, explanation: '2 × 2 × 2 = 8.' },
  { text: 'Une pieuvre très polie veut serrer la main à tout le monde : combien de « mains » peut-elle tendre en même temps ?', answer: 8, explanation: 'Elle a 8 bras !' },
  { text: 'Combien de minutes met la lumière du Soleil pour atteindre la Terre (environ) ?', answer: 8, explanation: 'Environ 8 minutes et 20 secondes.' },
  { text: 'Combien de milliards d\'êtres humains vivent sur Terre (arrondi) ?', answer: 8 },
  { text: 'Combien de nombres premiers sont inférieurs à 20 ?', answer: 8, explanation: '2, 3, 5, 7, 11, 13, 17 et 19.' },

  // ── 9 ──
  { text: 'Selon le dicton anglophone, combien de vies a un chat ?', answer: 9, explanation: 'Les Français, eux, ne lui en accordent que 7 !' },
  { text: 'Au football, combien de joueurs de champ reste-t-il à une équipe qui a un joueur expulsé ?', answer: 9, explanation: '11 joueurs − 1 gardien − 1 expulsé = 9.' },
  { text: 'Combien de chiffres composent un numéro de téléphone français si l\'on retire le 0 du début ?', answer: 9, explanation: '10 chiffres au total, moins le 0 initial.' },
  { text: 'Combien de symphonies Beethoven a-t-il achevées ?', answer: 9 },
  { text: 'Combien de Nazgûl (Cavaliers noirs) servent Sauron ?', answer: 9 },
  { text: 'Additionner tous les chiffres de la date 31/12/2027, puis répéter l’opération avec le résultat jusqu’à obtenir un seul chiffre', answer: 9, explanation: '3+1+1+2+2+0+2+7 = 18 -> 1+8 = 9 !' },
  { text: 'Combien de zéros compte un milliard écrit en chiffres ?', answer: 9 },
  { text: 'Combien de fois écrit-on le chiffre 9 en écrivant tous les nombres de 1 à 89 ?', answer: 9, explanation: '9, 19, 29, 39, 49, 59, 69, 79 et 89.' },
  { text: 'Combien font 3 + 3 × 2 ?', answer: 9, explanation: 'Piège : la multiplication passe d\'abord ! 3 + 6 = 9 (et non 12).' },
  { text: 'Combien de membres nommés siègent au Conseil constitutionnel français ?', answer: 9, explanation: 'Les anciens présidents de la République en sont en plus membres de droit.' }
];

// Questionnaires proposés à l'animateur (liste déroulante de l'écran de configuration)
const QUESTION_BANKS = {
  malin:     { label: 'Malin & rigolo (calculs, pièges, estimations)', questions: QUESTIONS_MALIGNES },
  classique: { label: 'Classique (culture générale simple)',           questions: QUESTIONS_CLASSIQUES }
};
Object.values(QUESTION_BANKS).forEach(b => { b.questions = b.questions.map((q, i) => ({ id: i + 1, ...q })); });
const DEFAULT_BANK = 'malin';
const QUESTIONS = QUESTION_BANKS[DEFAULT_BANK].questions;   // banque par défaut (export / tests)

const TARGETS = [25, 50, 75, 100];
const ROUND_COUNT = TARGETS.length;
const EXACT_TARGET_BONUS = 10;

// Bonus d'équipe : chacun apparaît à partir d'une manche (index 0 = manche 1) puis reste
// disponible aux manches suivantes. Chaque bonus est utilisable une fois par manche.
const BONUSES = [
  { id: 'fifty', fromRound: 1, icon: '50/50', name: 'Le 50-50', short: 'Éteint la moitié du clavier qui ne contient pas la bonne réponse' },
  { id: 'spy',   fromRound: 2, icon: '🕵️',    name: 'L\'Espion', short: 'Montre en direct les réponses des autres équipes' },
  { id: 'x2',    fromRound: 3, icon: '×2',    name: 'Le ×2',    short: 'Double les points de la question où il est joué' }
];

function roundBonuses(idx) {
  return BONUSES.filter(b => b.fromRound <= idx);
}

// Petit hachage déterministe (FNV-1a 32 bits) : sert à masquer l'indice du 50-50
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// Indice 50-50 envoyé discrètement au téléphone avec la question : un nombre aléatoire en base 36
// dont le bit de poids faible, combiné à un masque dérivé du playerId, de la manche et de la question,
// donne la moitié du clavier à garder (0 = 0-4, 1 = 5-9). Simple brouillage : rien n'est visible
// à l'écran, mais ce n'est pas du chiffrement (l'information est sur le téléphone, par conception).
function fiftyToken(answer, playerId, roundIdx, num) {
  const half = answer <= 4 ? 0 : 1;
  const mask = fnv(`${playerId}:${roundIdx}:${num}`) & 1;
  const noise = Math.floor(Math.random() * 0x3fffffff);
  return (((noise << 1) | (half ^ mask)) >>> 0).toString(36);
}

// Contrôle au démarrage, pour chaque questionnaire : 100 questions, réponses entières 0–9, 10 par chiffre
(function checkQuestions() {
  const errors = [];
  Object.entries(QUESTION_BANKS).forEach(([key, bank]) => {
    const qs = bank.questions;
    const err = msg => errors.push(`[${key}] ${msg}`);
    if (qs.length !== 100) err(`100 questions attendues, ${qs.length} trouvées`);
    const counts = Array(10).fill(0);
    qs.forEach(q => {
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 9) err(`Question ${q.id} : réponse invalide (${q.answer})`);
      else counts[q.answer]++;
      if (!q.text || typeof q.text !== 'string') err(`Question ${q.id} : texte manquant`);
    });
    counts.forEach((c, d) => { if (c !== 10) err(`Chiffre ${d} : ${c} questions au lieu de 10`); });
    const texts = new Set();
    qs.forEach(q => { if (texts.has(q.text)) err(`Question en double : ${q.text}`); texts.add(q.text); });
  });
  if (errors.length) {
    console.error('[SERVER] Banque de questions invalide :\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
})();

function bankList() {
  return Object.entries(QUESTION_BANKS).map(([id, b]) => ({ id, label: b.label, count: b.questions.length }));
}

// Questions du questionnaire choisi pour la session en cours
function sessionQuestions() {
  return QUESTION_BANKS[(session && session.bank) || DEFAULT_BANK].questions;
}

// ======================================================================
// ÉTAT EN MÉMOIRE
// ======================================================================

/*
  session = {
    code, teams: [{ id, name }], nextTeamId, connected: { [teamId]: playerId },
    bank: clé de QUESTION_BANKS (questionnaire choisi, modifiable en lobby),
    phase: 'lobby' | 'intro' | 'answering' | 'verifying' | 'roundEnd' | 'final',
    deck: [questionIdx...], deckPos, exhausted,
    round: 0..3,
    rounds: [{ target, participants: [teamId], questions: [{ qIdx, openedAt,
               shownAt: { [teamId]: ms },   // 1er envoi de la question au téléphone (départ du chrono)
               answers: { [teamId]: { value, ms, forced } } }],
               stopped: { [teamId]: questionPosInRound }, verifyPos, results }],
    totals: { [teamId]: { score, overs, exactTargets, exactAnswers } }
  }
*/

let session = null;

// ======================================================================
// UTILITAIRES
// ======================================================================

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function badRequest(res, msg) {
  json(res, { error: msg }, 400);
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ct = contentType.startsWith('text/') ? contentType + '; charset=utf-8' : contentType;
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) { reject(new Error('Requête trop volumineuse')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

function lanAddresses() {
  const out = [];
  Object.values(os.networkInterfaces()).forEach(list => (list || []).forEach(a => {
    if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }));
  return out;
}

class GameError extends Error {}
function fail(msg) { throw new GameError(msg); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cleanName(name, fallback) {
  const s = String(name === undefined || name === null ? '' : name).trim().slice(0, 40);
  return s || fallback;
}

function emptyTotals() {
  return { score: 0, overs: 0, exactTargets: 0, exactAnswers: 0 };
}

// ======================================================================
// LOGIQUE DE JEU — FONCTIONS PURES
// ======================================================================

/**
 * Calcule le détail et les résultats d'une manche.
 * @param round      { target, participants, questions }
 * @param questions  banque de questions (QUESTIONS)
 * @returns { questions: [{ qIdx, answer, entries: { [teamId]: {...} } }],
 *            teams: { [teamId]: { cumul, precision, speed, exactAnswers, over,
 *                                 exactTarget, gap, gained, adjust, score, answered } } }
 * Règles :
 *  - Seules les questions avec au moins une réponse sont prises en compte.
 *  - La jauge (cumul réel) avance de la valeur de la bonne réponse pour toutes
 *    les équipes encore en jeu, quelle que soit leur réponse.
 *  - Les points sont gagnés au fil des questions vérifiées :
 *      réponse exacte      : valeur de la bonne réponse + 3
 *      écart de 1          : valeur de la bonne réponse + 1
 *      écart de 2 ou plus  : 0 point (idem estimation forcée par l'animateur)
 *      rapidité            : +1 à l'équipe exacte la plus rapide (réponses non
 *                            forcées)
 *  - Bonus ×2 (manche 4) : les points de la question où il est
 *    joué sont doublés (valeur + précision + rapidité). 0 point × 2 = 0.
 *  - Une équipe dont la jauge dépasse la cible (y compris à la question qui la
 *    fait dépasser) ne marque plus aucun point par question : ni valeur de la
 *    bonne réponse, ni précision, ni rapidité. L'équipe la plus rapide est
 *    désignée parmi les équipes exactes qui ne sont pas au-dessus de la cible.
 *  - Bilan de fin de manche (jauge = cumul réel) :
 *      cumul > cible  : perd (cumul - cible) points ;
 *      cumul = cible  : +10 ;
 *      cumul < cible  : +10 - (cible - cumul), sans descendre sous 0.
 */
function endOfRoundAdjust(cumul, target) {
  if (cumul > target) return -(cumul - target);
  return Math.max(0, EXACT_TARGET_BONUS - (target - cumul));
}

function computeRoundResults(round, questions) {
  const teams = {};
  round.participants.forEach(t => {
    teams[t] = { cumul: 0, precision: 0, speed: 0, x2Extra: 0, exactAnswers: 0, answered: 0, gained: 0 };
  });

  const detail = [];
  round.questions.forEach(q => {
    const teamIds = Object.keys(q.answers).filter(t => teams[t]);
    if (teamIds.length === 0) return;
    const answer = questions[q.qIdx].answer;

    // Équipe exacte la plus rapide (réponses réelles, équipes non au-dessus de la cible)
    let fastest = null;
    teamIds.forEach(t => {
      const a = q.answers[t];
      if (a.forced || a.value !== answer) return;
      if (teams[t].cumul + answer > round.target) return;
      if (fastest === null || a.ms < q.answers[fastest].ms) fastest = t;
    });

    const entries = {};
    teamIds.forEach(t => {
      const a = q.answers[t];
      const s = teams[t];
      const diff = Math.abs(a.value - answer);
      const exact = !a.forced && diff === 0;
      const near = !a.forced && diff === 1;
      s.cumul += answer;
      const over = s.cumul > round.target;          // au-dessus de la cible : plus aucun point
      const close = !a.forced && diff <= 1;           // écart 0 ou 1 : seul cas qui rapporte des points
      const precision = (over || !close) ? 0 : (diff === 0 ? 3 : 1);
      let speed = 0;
      if (!over && t === fastest) speed = 1;
      const base = (over || !close) ? 0 : answer + precision + speed;
      const x2 = !!a.x2;                                // bonus ×2 joué sur cette question
      const gain = x2 ? base * 2 : base;
      s.precision += precision;
      s.speed += speed;
      s.x2Extra += gain - base;
      s.gained += gain;
      s.answered += 1;
      if (exact && !over) s.exactAnswers += 1;
      entries[t] = {
        value: a.value, ms: a.ms, forced: !!a.forced,
        precision, speed, exact, near, gain, over, x2, fifty: !!a.fifty, spy: !!a.spy,
        fastest: t === fastest,
        cumul: s.cumul
      };
    });
    detail.push({ qIdx: q.qIdx, answer, entries });
  });

  Object.keys(teams).forEach(t => {
    const s = teams[t];
    s.over = s.cumul > round.target;
    s.exactTarget = s.cumul === round.target;
    s.gap = round.target - s.cumul;                 // > 0 : sous la cible, < 0 : dépassement
    s.adjust = s.answered ? endOfRoundAdjust(s.cumul, round.target) : 0;
    s.score = s.gained + s.adjust;
  });

  return { questions: detail, teams };
}
/**
 * Classe les équipes : score total, puis moins de dépassements,
 * puis plus de manches pile, puis plus de réponses exactes. Sinon ex æquo.
 * @param teams  [{ id, name }]
 * @param totals { [teamId]: { score, overs, exactTargets, exactAnswers } }
 */
function rankTeams(teams, totals) {
  const list = teams.map(t => ({ id: t.id, name: t.name, ...(totals[t.id] || emptyTotals()) }));
  const cmp = (a, b) =>
    (b.score - a.score) ||
    (a.overs - b.overs) ||
    (b.exactTargets - a.exactTargets) ||
    (b.exactAnswers - a.exactAnswers);
  list.sort(cmp);
  list.forEach((t, i) => {
    t.rank = (i > 0 && cmp(list[i - 1], t) === 0) ? list[i - 1].rank : i + 1;
  });
  return list;
}

// ======================================================================
// LOGIQUE DE JEU — ÉTAT DE SESSION
// ======================================================================

function requireSession() {
  if (!session) fail('Pas de session active');
  return session;
}

function teamById(id) {
  return session.teams.find(t => t.id === id) || null;
}

function curRound() {
  return session.rounds[session.round] || null;
}

function curQuestion() {
  const r = curRound();
  return r && r.questions.length ? r.questions[r.questions.length - 1] : null;
}

function activeTeams(round) {
  return round.participants.filter(t => round.stopped[t] === undefined && teamById(t));
}

function pendingTeams() {
  const r = curRound();
  const q = curQuestion();
  if (!r || !q || session.phase !== 'answering') return [];
  return activeTeams(r).filter(t => !q.answers[t]);
}

function requirePlayer(body) {
  requireSession();
  const teamId = String(body.teamId || '');
  if (!teamById(teamId)) fail('Équipe inconnue');
  if (!body.playerId || session.connected[teamId] !== body.playerId) fail('Ce téléphone n\'est plus connecté à cette équipe');
  return teamId;
}

function newRound(idx) {
  return {
    target: TARGETS[idx],
    participants: session.teams.map(t => t.id),
    questions: [],
    stopped: {},
    bonusUsed: {},          // { [teamId]: { [bonusId]: n° de question (1..) } }
    verifyPos: 0,
    results: null,
    exhausted: false
  };
}

// ── Historique des questions posées (par questionnaire, conservé d'une partie à l'autre
//    tant que le serveur tourne) ──

function askedSet() {
  session.asked = session.asked || {};
  return new Set(session.asked[session.bank] || []);
}

function markAsked(qIdx) {
  const set = askedSet();
  set.add(qIdx);
  session.asked[session.bank] = [...set];
}

function freshCount() {
  return sessionQuestions().length - askedSet().size;
}

// Pioche de la partie : d'abord les questions jamais posées (mélangées), puis les déjà vues
// (mélangées) en complément si la partie va jusque-là. Quand tout a été posé, un nouveau
// cycle commence (historique remis à zéro pour ce questionnaire).
function buildDeck() {
  const all = sessionQuestions().map((_, i) => i);
  let asked = askedSet();
  if (asked.size >= all.length) {
    session.asked[session.bank] = [];
    asked = new Set();
    console.log(`[SERVER] Questionnaire « ${session.bank} » entièrement posé : nouveau cycle`);
  }
  const fresh = shuffle(all.filter(i => !asked.has(i)));
  const seen = shuffle(all.filter(i => asked.has(i)));
  return fresh.concat(seen);
}

function openNextQuestion() {
  const r = curRound();
  if (session.deckPos >= session.deck.length) {
    session.exhausted = true;
    r.exhausted = true;
    enterVerifying();
    return;
  }
  const qIdx = session.deck[session.deckPos++];
  markAsked(qIdx);
  r.questions.push({ qIdx, openedAt: Date.now(), shownAt: {}, answers: {} });
  session.phase = 'answering';
}

// Vérifie qu'un bonus peut être joué sur la question en cours (idempotent : rejouer
// le même bonus sur la même question est accepté, par exemple après un 50-50 déjà enregistré).
function checkBonus(round, teamId, bonusId) {
  if (!roundBonuses(session.round).some(b => b.id === bonusId)) fail('Bonus indisponible dans cette manche');
  const used = (round.bonusUsed[teamId] || {})[bonusId];
  if (used && used !== round.questions.length) fail('Bonus déjà utilisé dans cette manche');
}

function useBonus(round, teamId, bonusId) {
  round.bonusUsed[teamId] = round.bonusUsed[teamId] || {};
  round.bonusUsed[teamId][bonusId] = round.questions.length;
}

// Espion : réponses déjà données par chacune des autres équipes (réponses forcées exclues)
function spyReport(round, q, teamId) {
  const others = activeTeams(round).filter(t => t !== teamId);
  const answers = others
    .filter(t => q.answers[t] && !q.answers[t].forced)
    .sort((x, y) => q.answers[x].at - q.answers[y].at)                 // dans l'ordre d'arrivée
    .map(t => ({ name: teamById(t).name, value: q.answers[t].value }));
  return {
    answers,                                                           // [{ name, value }]
    count: answers.length,                                             // équipes espionnées
    total: others.length                                               // autres équipes en jeu
  };
}

function revealableQuestions(round) {
  return round.questions.filter(q => Object.keys(q.answers).length > 0);
}

// Étapes de vérification : une par question révélée + une étape « bilan de manche »
function verifySteps(round) {
  const n = revealableQuestions(round).length;
  return n > 0 ? n + 1 : 0;
}

function enterVerifying() {
  const r = curRound();
  r.verifyPos = 0;
  session.phase = 'verifying';
  console.log(`[SERVER] Manche ${session.round + 1} : vérification (${revealableQuestions(r).length} question(s))`);
}

function finalizeRound() {
  const r = curRound();
  const res = computeRoundResults(r, sessionQuestions());
  r.results = res.teams;
  Object.keys(res.teams).forEach(t => {
    if (!session.totals[t]) return; // équipe supprimée entre-temps
    const s = res.teams[t];
    const tot = session.totals[t];
    tot.score += s.score;
    if (s.over) tot.overs += 1;
    if (s.exactTarget) tot.exactTargets += 1;
    tot.exactAnswers += s.exactAnswers;
  });
  session.phase = 'roundEnd';
  console.log(`[SERVER] Manche ${session.round + 1} terminée`);
}

function estimatedCumul(round, teamId) {
  return round.questions.reduce((sum, q) => sum + (q.answers[teamId] ? q.answers[teamId].value : 0), 0);
}

// ======================================================================
// VUES FILTRÉES
// ======================================================================

function roundScoresByTeam() {
  // { [teamId]: [score M1, score M2, ...] } (null si non jouée / non participant)
  const out = {};
  session.teams.forEach(t => {
    out[t.id] = session.rounds.map(r => (r.results && r.results[t.id]) ? r.results[t.id].score : null);
  });
  return out;
}

function adminView() {
  if (!session) return { session: null };
  const r = curRound();
  const view = {
    code: session.code,
    phase: session.phase,
    bank: session.bank,
    banks: bankList(),
    freshCount: freshCount(),          // questions jamais posées dans ce questionnaire
    askedCount: askedSet().size,
    teams: session.teams.map(t => ({ id: t.id, name: t.name, connected: !!session.connected[t.id] })),
    round: session.round,
    roundCount: ROUND_COUNT,
    targets: TARGETS,
    target: r ? r.target : TARGETS[0],
    deckRemaining: session.deck.length ? session.deck.length - session.deckPos : sessionQuestions().length,
    exhausted: session.exhausted,
    ranking: rankTeams(session.teams, session.totals),
    roundScores: roundScoresByTeam(),
    canEditTeams: session.phase === 'lobby' || session.phase === 'roundEnd'
  };

  view.bonuses = roundBonuses(session.round);              // bonus de la manche (intro, règles)
  view.newBonus = BONUSES.find(b => b.fromRound === session.round) || null;

  if (r) {
    view.participants = r.participants.filter(t => teamById(t));
    view.questionCount = r.questions.length;
  }

  if (session.phase === 'answering') {
    const q = curQuestion();
    const statuses = {};
    session.teams.forEach(t => {
      if (!r.participants.includes(t.id)) statuses[t.id] = 'out';
      else if (r.stopped[t.id] !== undefined) statuses[t.id] = 'stopped';
      else if (q.answers[t.id]) statuses[t.id] = q.answers[t.id].forced ? 'forced' : 'answered';
      else statuses[t.id] = 'thinking';
    });
    const pending = pendingTeams();
    const bonusNow = {};      // bonus joués sur la question en cours (n'indique rien sur la réponse)
    Object.keys(r.bonusUsed).forEach(t => {
      const used = Object.keys(r.bonusUsed[t]).filter(b => r.bonusUsed[t][b] === r.questions.length);
      if (used.length) bonusNow[t] = used;
    });
    view.current = {
      bonusNow,
      num: r.questions.length,
      text: sessionQuestions()[q.qIdx].text,
      statuses,             // jamais les valeurs pendant la phase de réponses
      pending: pending.length,
      active: activeTeams(r).length
    };
  }

  if (session.phase === 'verifying' || session.phase === 'roundEnd' || session.phase === 'final') {
    if (r) {
      const res = computeRoundResults(r, sessionQuestions());
      const total = res.questions.length;
      const steps = total > 0 ? total + 1 : 0;
      const revealed = session.phase === 'verifying' ? r.verifyPos : steps;
      const stoppedAt = {};
      Object.keys(r.stopped).forEach(t => { stoppedAt[t] = r.stopped[t] + 1; });
      view.verify = {
        total,
        steps,
        revealed,
        roundExhausted: r.exhausted,
        stoppedAt,
        bilan: revealed > total ? Object.fromEntries(Object.keys(res.teams).map(t => [t, {
          cumul: res.teams[t].cumul, gap: res.teams[t].gap, adjust: res.teams[t].adjust,
          over: res.teams[t].over, exactTarget: res.teams[t].exactTarget, answered: res.teams[t].answered
        }])) : null,
        questions: res.questions.slice(0, Math.min(revealed, total)).map((d, i) => ({
          num: i + 1,
          text: sessionQuestions()[d.qIdx].text,
          answer: d.answer,
          explanation: sessionQuestions()[d.qIdx].explanation || '',
          entries: d.entries
        }))
      };
      if (session.phase !== 'verifying') view.roundResults = res.teams;
    }
  }
  return { session: view };
}

function playerView(teamId, playerId) {
  if (!session) return { session: null };
  const r = curRound();
  const view = {
    code: session.code,
    phase: session.phase,
    teams: session.teams.map(t => ({ id: t.id, name: t.name, taken: !!session.connected[t.id] })),
    round: session.round,
    roundCount: ROUND_COUNT,
    target: r ? r.target : TARGETS[0],
    bonuses: roundBonuses(session.round).map(b => ({ id: b.id, name: b.name }))
  };

  const team = teamId ? teamById(teamId) : null;
  if (!team) return { session: view, me: null };

  const me = {
    teamId: team.id,
    name: team.name,
    isMe: !!playerId && session.connected[team.id] === playerId,
    participant: !!(r && r.participants.includes(team.id))
  };

  if (r && me.participant) {
    me.estimated = estimatedCumul(r, team.id);
    me.stopped = r.stopped[team.id] !== undefined;
    me.answeredCount = r.questions.filter(q => q.answers[team.id]).length;
  }

  if (session.phase === 'answering' && r && me.participant) {
    const q = curQuestion();
    const a = q.answers[team.id];
    me.question = { num: r.questions.length, text: sessionQuestions()[q.qIdx].text };   // jamais la réponse
    me.answered = a ? { value: a.value, forced: !!a.forced, x2: !!a.x2 } : null;
    // Bonus : disponibles (non encore utilisés dans la manche) et déjà joués sur cette question
    const used = r.bonusUsed[team.id] || {};
    me.bonuses = roundBonuses(session.round).map(b => ({
      id: b.id, icon: b.icon, name: b.name,
      usedAt: used[b.id] || null,                       // n° de question où il a été joué
      now: used[b.id] === r.questions.length             // joué sur la question en cours
    }));
    // 50-50 : indice brouillé envoyé avec la question (uniquement au téléphone de l'équipe,
    // tant que le bonus est disponible ou joué sur cette question) → activation sans aller-retour.
    if (me.isMe && !a && roundBonuses(session.round).some(b => b.id === 'fifty')
        && (!used.fifty || used.fifty === r.questions.length)) {
      me.question.k = fiftyToken(sessionQuestions()[q.qIdx].answer, playerId, session.round, r.questions.length);
    }
    // Espion actif sur cette question : réponses des autres équipes, mises à jour en direct
    if (me.isMe && used.spy === r.questions.length) me.spy = spyReport(r, q, team.id);
    // Équipes espionnées : prévenues dès que l'Espion est joué, avant même de répondre
    // (une réponse forcée n'est pas montrée à l'espion : pas d'alerte dans ce cas).
    if (!a || !a.forced) {
      me.spiedBy = Object.keys(r.bonusUsed)
        .filter(t => t !== team.id && r.bonusUsed[t].spy === r.questions.length && teamById(t))
        .map(t => teamById(t).name);
    }
    // Chrono propre à l'équipe : démarre la première fois que la question est envoyée
    // au téléphone connecté de l'équipe (et jamais remis à zéro, même si la page est rechargée).
    if (me.isMe && !a && r.stopped[team.id] === undefined && q.shownAt[team.id] === undefined) {
      q.shownAt[team.id] = Date.now();
    }
  }

  if ((session.phase === 'roundEnd' || session.phase === 'final') && r && r.results && r.results[team.id]) {
    const s = r.results[team.id];
    me.roundResult = { score: s.score, cumul: s.cumul, over: s.over, exactTarget: s.exactTarget, adjust: s.adjust, gap: s.gap };
  }

  if (session.phase === 'roundEnd' || session.phase === 'final') {
    const ranking = rankTeams(session.teams, session.totals);
    const mine = ranking.find(t => t.id === team.id);
    if (mine) { me.total = mine.score; me.rank = mine.rank; me.teamCount = ranking.length; }
  }

  return { session: view, me };
}

// ======================================================================
// ROUTES API
// ======================================================================

const routes = {

  // ── Crée (ou remplace) la session
  'POST /api/session/create': (body) => {
    const names = Array.isArray(body.teams) && body.teams.length ? body.teams : ['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4'];
    const teams = names.map((n, i) => ({ id: 't' + (i + 1), name: cleanName(n, 'Équipe ' + (i + 1)) }));
    const bank = QUESTION_BANKS[body.bank] ? body.bank : DEFAULT_BANK;
    // « Nouveau code de partie » : l'historique des questions posées est conservé
    const asked = (session && session.asked) || {};
    session = {
      code: genCode(),
      bank,
      asked,                 // { [bank]: [qIdx…] } questions déjà posées dans les parties précédentes
      teams,
      nextTeamId: teams.length + 1,
      connected: {},
      phase: 'lobby',
      deck: [],
      deckPos: 0,
      exhausted: false,
      round: 0,
      rounds: [],
      totals: Object.fromEntries(teams.map(t => [t.id, emptyTotals()]))
    };
    console.log(`[SERVER] Session créée : ${session.code} — ${teams.length} équipes`);
    return { code: session.code };
  },

  // ── Oublie les questions déjà posées du questionnaire choisi (nouveau public)
  'POST /api/history/clear': () => {
    requireSession();
    if (session.phase !== 'lobby') fail('Possible uniquement avant le début de la partie');
    session.asked = session.asked || {};
    session.asked[session.bank] = [];
    console.log(`[SERVER] Historique des questions effacé (${session.bank})`);
    return { ok: true };
  },

  // ── Choix du questionnaire (avant le début de la partie uniquement)
  'POST /api/bank/select': (body) => {
    requireSession();
    if (session.phase !== 'lobby') fail('Le questionnaire ne peut être changé qu\'avant le début de la partie');
    const bank = String(body.bank || '');
    if (!QUESTION_BANKS[bank]) fail('Questionnaire inconnu');
    session.bank = bank;
    console.log(`[SERVER] Questionnaire choisi : ${bank}`);
    return { ok: true, bank };
  },

  // ── Gestion des équipes
  'POST /api/teams/add': (body) => {
    requireSession();
    if (session.phase !== 'lobby' && session.phase !== 'roundEnd') fail('Ajout d\'équipe possible uniquement avant la partie ou entre deux manches');
    if (session.teams.length >= 30) fail('Nombre maximal d\'équipes atteint');
    const id = 't' + (session.nextTeamId++);
    const team = { id, name: cleanName(body.name, 'Équipe ' + (session.teams.length + 1)) };
    session.teams.push(team);
    session.totals[id] = emptyTotals();
    return { ok: true, team };
  },

  'POST /api/teams/remove': (body) => {
    requireSession();
    if (session.phase !== 'lobby' && session.phase !== 'roundEnd') fail('Suppression d\'équipe possible uniquement avant la partie ou entre deux manches');
    const teamId = String(body.teamId || '');
    if (!teamById(teamId)) fail('Équipe inconnue');
    if (session.teams.length <= 2) fail('Il faut au moins 2 équipes');
    session.teams = session.teams.filter(t => t.id !== teamId);
    delete session.connected[teamId];
    delete session.totals[teamId];
    return { ok: true };
  },

  'POST /api/teams/rename': (body) => {
    requireSession();
    const team = teamById(String(body.teamId || ''));
    if (!team) fail('Équipe inconnue');
    team.name = cleanName(body.name, team.name);
    return { ok: true, team };
  },

  // ── Libère l'équipe (téléphone perdu / changé)
  'POST /api/teams/kick': (body) => {
    requireSession();
    const teamId = String(body.teamId || '');
    if (!teamById(teamId)) fail('Équipe inconnue');
    delete session.connected[teamId];
    return { ok: true };
  },

  // ── Un capitaine rejoint la partie
  'POST /api/join': (body) => {
    requireSession();
    if (String(body.code || '').trim().toUpperCase() !== session.code) fail('Code invalide');
    const teamId = String(body.teamId || '');
    const team = teamById(teamId);
    if (!team) fail('Équipe invalide');
    if (!body.playerId) fail('playerId requis');
    const current = session.connected[teamId];
    if (current && current !== body.playerId) fail('Cette équipe est déjà connectée sur un autre téléphone');
    session.connected[teamId] = String(body.playerId);
    console.log(`[SERVER] ${team.name} connectée (${Object.keys(session.connected).length}/${session.teams.length})`);
    return { ok: true, teamId, teamName: team.name };
  },

  // ── Démarre la partie → intro manche 1
  'POST /api/game/start': () => {
    requireSession();
    if (session.phase !== 'lobby') fail('La partie est déjà commencée');
    if (session.teams.length < 2) fail('Il faut au moins 2 équipes');
    session.deck = buildDeck();
    session.deckPos = 0;
    session.exhausted = false;
    session.round = 0;
    session.totals = Object.fromEntries(session.teams.map(t => [t.id, emptyTotals()]));
    session.rounds = [newRound(0)];
    session.phase = 'intro';
    console.log(`[SERVER] Partie démarrée (${freshCount()} question(s) jamais posée(s) sur ${sessionQuestions().length})`);
    return { ok: true };
  },

  // ── Fin de l'intro → ouvre la première question de la manche
  'POST /api/round/begin': () => {
    requireSession();
    if (session.phase !== 'intro') fail('Aucune manche à lancer');
    openNextQuestion();
    return { ok: true };
  },

  // ── Question suivante (force : estimations 0 pour les retardataires)
  'POST /api/question/next': (body) => {
    requireSession();
    if (session.phase !== 'answering') fail('Pas de question en cours');
    const r = curRound();
    const q = curQuestion();
    const pending = pendingTeams();
    if (pending.length && !body.force) fail(`${pending.length} équipe(s) n'ont pas encore répondu`);
    pending.forEach(t => { q.answers[t] = { value: 0, ms: null, forced: true }; });
    if (activeTeams(r).length === 0) enterVerifying();
    else openNextQuestion();
    return { ok: true, forced: pending.length };
  },

  // ── Réponse d'un capitaine
  'POST /api/answer': (body) => {
    const teamId = requirePlayer(body);
    if (session.phase !== 'answering') fail('La saisie est fermée');
    const r = curRound();
    const q = curQuestion();
    if (!r.participants.includes(teamId)) fail('Votre équipe rejoindra la prochaine manche');
    if (r.stopped[teamId] !== undefined) fail('Vous êtes arrêtés pour cette manche');
    if (q.answers[teamId]) fail('Réponse déjà enregistrée');
    const value = Number(body.value);
    if (!Number.isInteger(value) || value < 0 || value > 9) fail('Réponse invalide (0 à 9)');
    // Bonus joués avec la réponse (×2) ou juste avant (50-50, déjà enregistré ou envoyé ici en secours)
    const wanted = Array.isArray(body.bonuses) ? body.bonuses.map(String) : [];
    wanted.forEach(b => checkBonus(r, teamId, b));
    wanted.forEach(b => useBonus(r, teamId, b));
    const used = r.bonusUsed[teamId] || {};
    const num = r.questions.length;
    // Temps mesuré depuis l'envoi de la question au téléphone de l'équipe
    // (repli sur l'ouverture de la question si l'envoi n'a pas été enregistré).
    const start = q.shownAt[teamId] !== undefined ? q.shownAt[teamId] : q.openedAt;
    const ms = Date.now() - start;
    q.answers[teamId] = { value, ms, at: Date.now(), forced: false, x2: used.x2 === num, fifty: used.fifty === num, spy: used.spy === num };
    return { ok: true, ms, estimated: estimatedCumul(r, teamId), x2: used.x2 === num };
  },

  // ── Bonus joué avant la réponse (50-50) : le téléphone éteint déjà le clavier localement ;
  //    cet appel l'enregistre (pour que le bonus soit consommé même sans réponse ensuite).
  'POST /api/bonus': (body) => {
    const teamId = requirePlayer(body);
    if (session.phase !== 'answering') fail('Pas de question en cours');
    const r = curRound();
    const q = curQuestion();
    if (!r.participants.includes(teamId)) fail('Votre équipe rejoindra la prochaine manche');
    if (r.stopped[teamId] !== undefined) fail('Vous êtes arrêtés pour cette manche');
    if (q.answers[teamId]) fail('Réponse déjà enregistrée');
    const bonus = String(body.bonus || '');
    if (bonus !== 'fifty' && bonus !== 'spy') fail('Ce bonus se joue avec la réponse');
    checkBonus(r, teamId, bonus);
    useBonus(r, teamId, bonus);
    console.log(`[SERVER] ${teamById(teamId).name} : bonus ${bonus} à la question ${r.questions.length}`);
    return { ok: true };
  },

  // ── STOP définitif pour la manche
  'POST /api/stop': (body) => {
    const teamId = requirePlayer(body);
    if (session.phase !== 'answering') fail('Pas de question en cours');
    const r = curRound();
    const q = curQuestion();
    if (!r.participants.includes(teamId)) fail('Votre équipe rejoindra la prochaine manche');
    if (r.stopped[teamId] !== undefined) fail('Vous êtes déjà arrêtés');
    if (q.answers[teamId]) fail('Vous avez déjà répondu : STOP possible à la question suivante');
    r.stopped[teamId] = r.questions.length - 1;
    console.log(`[SERVER] ${teamById(teamId).name} : STOP à la question ${r.questions.length}`);
    if (activeTeams(r).length === 0) enterVerifying();
    return { ok: true, estimated: estimatedCumul(r, teamId) };
  },

  // ── Vérification : révèle l'étape suivante (question, puis bilan), puis calcule la manche
  'POST /api/verify/next': () => {
    requireSession();
    if (session.phase !== 'verifying') fail('Pas de vérification en cours');
    const r = curRound();
    if (r.verifyPos < verifySteps(r)) r.verifyPos++;
    else finalizeRound();
    return { ok: true };
  },

  // ── Manche suivante ou classement final
  'POST /api/round/next': () => {
    requireSession();
    if (session.phase !== 'roundEnd') fail('La manche n\'est pas terminée');
    if (session.round + 1 >= ROUND_COUNT || session.exhausted) {
      session.phase = 'final';
      console.log('[SERVER] Partie terminée');
    } else {
      session.round++;
      session.rounds.push(newRound(session.round));
      session.phase = 'intro';
    }
    return { ok: true };
  },

  // ── Nouvelle partie (équipes et connexions conservées)
  'POST /api/session/reset': () => {
    requireSession();
    session.phase = 'lobby';
    session.deck = [];
    session.deckPos = 0;
    session.exhausted = false;
    session.round = 0;
    session.rounds = [];
    session.totals = Object.fromEntries(session.teams.map(t => [t.id, emptyTotals()]));
    return { ok: true };
  },

  'POST /api/session/destroy': () => {
    session = null;
    console.log('[SERVER] Session détruite');
    return { ok: true };
  },

  'GET /api/network': () => ({ port: Number(PORT), addresses: lanAddresses() }),

  'GET /api/state': (body, url) => {
    if (url.searchParams.get('view') === 'admin') return adminView();
    return playerView(url.searchParams.get('teamId'), url.searchParams.get('playerId'));
  }
};

// ======================================================================
// SERVEUR HTTP
// ======================================================================

const server = http.createServer(async (req, res) => {

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ---------- Fichiers statiques ----------
  if (pathname === '/joueur' || pathname === '/joueur.html') {
    return serveFile(res, path.join(ROOT, 'joueur.html'), 'text/html');
  }
  if (pathname === '/' || pathname === '/index.html') {
    return serveFile(res, path.join(ROOT, 'index.html'), 'text/html');
  }
  if (pathname === '/admin.js') {
    return serveFile(res, path.join(ROOT, 'admin.js'), 'text/javascript');
  }
  if (pathname === '/qr.js') {
    return serveFile(res, path.join(ROOT, 'qr.js'), 'text/javascript');
  }
  if (pathname === '/rules.js') {
    return serveFile(res, path.join(ROOT, 'rules.js'), 'text/javascript');
  }
  if (pathname === '/rules.css') {
    return serveFile(res, path.join(ROOT, 'rules.css'), 'text/css');
  }
  if (pathname.startsWith('/images/')) {
    const ext = path.extname(pathname).toLowerCase();
    const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(path.join(ROOT, 'images'))) { res.writeHead(403); res.end('Forbidden'); return; }
    return serveFile(res, filePath, types[ext] || 'application/octet-stream');
  }

  // ---------- API ----------
  const handler = routes[`${req.method} ${pathname}`];
  if (!handler) { res.writeHead(404); res.end('Not found'); return; }

  try {
    const body = req.method === 'POST' ? await parseBody(req) : {};
    return json(res, handler(body, url));
  } catch (e) {
    if (e instanceof GameError || e.message === 'JSON invalide' || e.message === 'Requête trop volumineuse') {
      return badRequest(res, e.message);
    }
    console.error('[SERVER] Erreur :', e);
    return json(res, { error: 'Erreur interne du serveur' }, 500);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║        BLIND QUIZZ — Serveur de jeu              ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Animateur → http://localhost:${PORT}                ║`);
    console.log(`║  Joueur    → http://localhost:${PORT}/joueur         ║`);
    console.log('║                                                  ║');
    console.log('║  Sur le réseau local, remplacer localhost par    ║');
    console.log('║  l\'adresse IP de cette machine (ex: 192.168.x.x) ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Questionnaires : ${bankList().map(b => `${b.id} (${b.count})`).join(', ')}.`);
    console.log('');
  });
}

module.exports = { QUESTIONS, QUESTION_BANKS, TARGETS, BONUSES, fnv, computeRoundResults, rankTeams, server };
