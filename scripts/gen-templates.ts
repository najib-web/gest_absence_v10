// Generate the 3 import template files into /public/templates
// - ListEleve_20260905.xlsx     (élèves + classe + niveau)
// - Liste enseignants.xlsx      (enseignants + matière + email optionnel)
// - tableaux de services.csv    (grille hebdomadaire)
import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "fs";

const OUT_DIR = "/home/z/my-project/public/templates";
mkdirSync(OUT_DIR, { recursive: true });

function styleSheet(rows: (string | number)[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

// ============ 1) ListEleve_20260905.xlsx ============
const elevesRows: (string | number)[][] = [
  ["Code Massar", "Nom", "Prénom", "Nom (arabe)", "Prénom (arabe)", "Téléphone parent", "Classe", "Niveau"],
  ["R13000001", "Alaoui", "Youssef", "العلوي", "يوسف", "0661234501", "TCSF-1", "Tronc Commun"],
  ["R13000002", "Benjelloun", "Aya", "بنجلون", "آية", "0661234502", "TCSF-1", "Tronc Commun"],
  ["R13000003", "Chakiri", "Omar", "الشكيري", "عمر", "0661234503", "TCSF-1", "Tronc Commun"],
  ["R13000004", "Douiri", "Salma", "الدويري", "سلمى", "0661234504", "TCSF-1", "Tronc Commun"],
  ["R13000005", "El Amrani", "Mehdi", "العمراني", "مهدي", "0661234505", "TCSF-2", "Tronc Commun"],
  ["R13000006", "Farouki", "Nadia", "الفاروقي", "نادية", "0661234506", "TCSF-2", "Tronc Commun"],
  ["R13000007", "Ghali", "Hamza", "الغالي", "حمزة", "0661234507", "1BACSC-1", "1ère Année Bac"],
  ["R13000008", "Hassani", "Imane", "الحساني", "إيمان", "0661234508", "1BACSC-1", "1ère Année Bac"],
  ["R13000009", "Idrissi", "Karim", "الإدريسي", "كريم", "0661234509", "2BACPC-1", "2ème Année Bac"],
  ["R13000010", "Jaidi", "Laila", "الجاعيدي", "ليلى", "0661234510", "2BACPC-1", "2ème Année Bac"],
  ["R13000011", "Kettani", "Adam", "الكتاني", "آدم", "0661234511", "2BACPC-2", "2ème Année Bac"],
  ["R13000012", "Lamrani", "Sofia", "العمراني", "صوفيا", "0661234512", "2BACPC-2", "2ème Année Bac"],
];
const wbEleves = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wbEleves,
  styleSheet(elevesRows, [14, 16, 16, 16, 16, 16, 12, 18]),
  "Élèves"
);
XLSX.writeFile(wbEleves, `${OUT_DIR}/ListEleve_20260905.xlsx`);

// ============ 2) Liste enseignants.xlsx ============
const profsRows: (string | number)[][] = [
  ["PPR", "Nom", "Prénom", "Nom (arabe)", "Prénom (arabe)", "Matière", "Téléphone", "Email", "Mot de passe"],
  ["152340", "Bennani", "Ahmed", "بناني", "أحمد", "Mathématiques", "0662345601", "a.bennani@edu.ma", ""],
  ["152341", "Chraibi", "Fatima Zahra", "الشرابي", "فاطمة الزهراء", "Physique-Chimie", "0662345602", "", ""],
  ["152342", "Daoudi", "Hassan", "داودي", "حسن", "SVT", "0662345603", "h.daoudi@edu.ma", ""],
  ["152343", "Erragragui", "Khadija", "الرغراغي", "خديجة", "Français", "0662345604", "", ""],
  ["152344", "Filali", "Mostafa", "الفيلالي", "مصطفى", "Anglais", "0662345605", "m.filali@edu.ma", ""],
  ["152345", "Guedira", "Samira", "كديرة", "سميرة", "Arabe", "0662345606", "", ""],
  ["152346", "Hakimi", "Youssef", "الحكيمي", "يوسف", "EPS", "0662345607", "", ""],
  ["152347", "Idrissi", "Naima", "الإدريسي", "نعيمة", "Informatique", "0662345608", "n.idrissi@edu.ma", ""],
];
const wbProfs = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wbProfs,
  styleSheet(profsRows, [10, 16, 16, 16, 16, 20, 14, 24, 16]),
  "Enseignants"
);
XLSX.writeFile(wbProfs, `${OUT_DIR}/Liste enseignants.xlsx`);

// ============ 3) tableaux de services.csv ============
const csvRows: string[][] = [
  ["Jour", "Heure début", "Heure fin", "Classe", "Groupe", "Enseignant", "Matière"],
  ["Lundi", "08:00", "10:00", "TCSF-1", "", "Bennani Ahmed", "Mathématiques"],
  ["Lundi", "10:00", "12:00", "TCSF-2", "", "Chraibi Fatima Zahra", "Physique-Chimie"],
  ["Lundi", "14:00", "16:00", "1BACSC-1", "", "Daoudi Hassan", "SVT"],
  ["Lundi", "16:00", "18:00", "2BACPC-1", "", "Erragragui Khadija", "Français"],
  ["Mardi", "08:00", "10:00", "TCSF-1", "G1", "Bennani Ahmed", "Mathématiques (TP)"],
  ["Mardi", "10:00", "12:00", "2BACPC-1", "", "Chraibi Fatima Zahra", "Physique-Chimie"],
  ["Mardi", "14:00", "16:00", "1BACSC-1", "", "Filali Mostafa", "Anglais"],
  ["Mercredi", "08:00", "10:00", "TCSF-2", "", "Guedira Samira", "Arabe"],
  ["Mercredi", "14:00", "16:00", "2BACPC-2", "", "Idrissi Naima", "Informatique"],
  ["Jeudi", "08:00", "10:00", "1BACSC-1", "", "Bennani Ahmed", "Mathématiques"],
  ["Jeudi", "16:00", "18:00", "TCSF-1", "", "Hakimi Youssef", "EPS"],
  ["Vendredi", "08:00", "10:00", "2BACPC-1", "", "Chraibi Fatima Zahra", "Physique-Chimie"],
  ["Vendredi", "14:00", "15:00", "1BACSC-1", "", "Daoudi Hassan", "SVT"],
  ["Samedi", "08:00", "10:00", "2BACPC-2", "", "Erragragui Khadija", "Français"],
];
const csv =
  "\uFEFF" +
  csvRows.map((row) => row.map((c) => `"${c}"`).join(",")).join("\r\n");
writeFileSync(`${OUT_DIR}/tableaux de services.csv`, csv, "utf-8");

console.log("Templates générés dans", OUT_DIR);
