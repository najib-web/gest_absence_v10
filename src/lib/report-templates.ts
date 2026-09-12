// Modèles de rapports d'orientation prêts à l'emploi (bilingues FR/AR).
// Les placeholders {..} sont remplacés automatiquement par les informations
// de la séance et de l'élève avant insertion dans le champ de rédaction ;
// l'enseignant garde la main pour adapter librement le texte.

export interface ReportTemplate {
  id: string;
  labelFr: string;
  labelAr: string;
  titleFr: string;
  titleAr: string;
  contentFr: string;
  contentAr: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "absences-repetees",
    labelFr: "Signalement d'absences répétées",
    labelAr: "التبليغ عن غيابات متكررة",
    titleFr: "Signalement d'absences répétées",
    titleAr: "التبليغ عن غيابات متكررة",
    contentFr:
      "J'ai l'honneur de porter à votre connaissance que l'élève {eleve}, inscrit(e) en {classe}{groupe}, cumule {absences} absence(s) non justifiée(s) en cours de {matiere}, dépassant ainsi le seuil autorisé fixé à {seuil} absence(s).\n\nMalgré les rappels à l'ordre effectués en classe, la situation de l'élève n'a pas connu d'amélioration. Je vous prie de bien vouloir contacter les parents afin de régulariser sa situation et de garantir la poursuite normale de sa scolarité.\n\nVeuillez agréer mes salutations distinguées.",
    contentAr:
      "يطيب لي أن أضع بين أيديكم وضعية التلميذ(ة) {eleve}، المسجل(ة) بقسم {classe}{groupe}، حيث بلغ عدد غياباته غير المبررة في مادة {matiere} {absences} غياب، وهو ما تجاوز الحد المسموح به والمحدد في {seuil} غيابات.\n\nورغم التنبيهات والتوجيهات التي تمت داخل القسم، لم تتحسن وضعية التلميذ(ة). لذا أرجو من سيادتكم التكرم بالتواصل مع ولي الأمر قصد تبرير الغيابات وضمان مواصلة الدراسة في ظروف عادية.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.",
  },
  {
    id: "absence-non-justifiee",
    labelFr: "Absence non justifiée — demande de justification",
    labelAr: "غياب غير مبرر — طلب التبرير",
    titleFr: "Absence non justifiée",
    titleAr: "غياب غير مبرر",
    contentFr:
      "Je vous signale que l'élève {eleve}, de la classe {classe}{groupe}, était absent(e) au cours de {matiere} du {date}, sans justification présentée à ce jour.\n\nJe vous prie de bien vouloir convoquer le parent ou le tuteur de l'élève afin d'obtenir une justification de cette absence et de lui rappeler ses obligations concernant l'assiduité scolaire.\n\nVeuillez agréer mes salutations distinguées.",
    contentAr:
      "أشعركم أن التلميذ(ة) {eleve}، التابع(ة) لقسم {classe}{groupe}، تغيب(ت) عن حصة {matiere} ليوم {date} دون تقديم أي تبرير إلى اليوم.\n\nلذا أرجو من سيادتكم التكرم باستدعاء ولي أمر التلميذ(ة) قصد تبرير هذا الغياب، وتذكيره بالتزامات المنظومة التربوية فيما يخص الانتظام في الدراسة.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.",
  },
  {
    id: "retards-repetes",
    labelFr: "Signalement de retards répétés",
    labelAr: "التبليغ عن تأخرات متكررة",
    titleFr: "Retards répétés",
    titleAr: "تأخرات متكررة",
    contentFr:
      "J'ai l'honneur de vous informer que l'élève {eleve}, de la classe {classe}{groupe}, multiplie les retards lors des séances de {matiere}. Ce comportement perturbe le bon déroulement des cours et nuit au rendement scolaire de l'élève.\n\nJe vous prie de bien vouloir contacter les parents pour leur signaler cette situation et trouver, avec eux, les moyens d'y remédier.\n\nVeuillez agréer mes salutations distinguées.",
    contentAr:
      "يطيب لي أن أخبركم أن التلميذ(ة) {eleve}، التابع(ة) لقسم {classe}{groupe}، يتكرر تأخره عن حصص مادة {matiere}. هذا التصرف يعطل سير الدروس ويؤثر سلبا على المستوى الدراسي للتلميذ(ة).\n\nلذا أرجو التكرم بالتواصل مع ولي الأمر لإشعاره بهذه الوضعية والبحث معه في الوسائل الكفيلة بتجاوزها.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.",
  },
  {
    id: "faible-assiduite",
    labelFr: "Faible assiduité — suivi recommandé",
    labelAr: "ضعف الانتظام — ضرورة المتابعة",
    titleFr: "Faible assiduité",
    titleAr: "ضعف الانتظام",
    contentFr:
      "Je porte à votre connaissance que l'élève {eleve}, inscrit(e) en {classe}{groupe}, présente une assiduité préoccupante en cours de {matiere} : {absences} absence(s) non justifiée(s) enregistrée(s) à ce jour, pour un seuil autorisé de {seuil}.\n\nCette situation risque de compromettre sérieusement ses résultats scolaires. Un suivi rapproché et une rencontre avec les parents me semblent nécessaires.\n\nVeuillez agréer mes salutations distinguées.",
    contentAr:
      "أضع بين أيديكم وضعية التلميذ(ة) {eleve}، المسجل(ة) بقسم {classe}{groupe}، التي تستدعي الانتباه في مادة {matiere}: حيث تم تسجيل {absences} غياب غير مبرر إلى اليوم، في حين أن الحد المسموح به هو {seuil} غيابات.\n\nهذه الوضعية قد تؤثر بشكل كبير على نتائجه(ها) الدراسية. يبدو لي أن المتابعة الدقيقة ولقاء ولي الأمر أمران ضروريان.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.",
  },
  {
    id: "convocation-parents",
    labelFr: "Demande de convocation des parents",
    labelAr: "طلب استدعاء ولي الأمر",
    titleFr: "Demande de convocation des parents",
    titleAr: "طلب استدعاء ولي الأمر",
    contentFr:
      "J'ai l'honneur de demander la convocation des parents de l'élève {eleve}, de la classe {classe}{groupe}, afin de discuter de sa situation concernant les absences enregistrées en cours de {matiere} ({absences} absence(s) non justifiée(s) pour un seuil de {seuil}).\n\nLa présence des parents me paraît indispensable pour trouver ensemble une solution et rétablir l'assiduité de l'élève.\n\nVeuillez agréer mes salutations distinguées.",
    contentAr:
      "يطيب لي أن أطلب استدعاء ولي أمر التلميذ(ة) {eleve}، التابع(ة) لقسم {classe}{groupe}، من أجل مناقشة وضعه فيما يخص الغيابات المسجلة في مادة {matiere} ({absences} غياب غير مبرر مقابل حد {seuil}).\n\nيبدو لي أن حضور ولي الأمر ضروري للبحث بشكل مشترك في الحلول الكفيلة بإعادة التلميذ(ة) إلى الانتظام في الدراسة.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.",
  },
  {
    id: "comportement",
    labelFr: "Comportement perturbateur en classe",
    labelAr: "سلوك مزعج داخل القسم",
    titleFr: "Comportement en classe",
    titleAr: "السلوك داخل القسم",
    contentFr:
      "Je vous informe que l'élève {eleve}, de la classe {classe}{groupe}, adopte un comportement perturbateur lors des séances de {matiere} (le {date}) : refus de travailler, perturbation du cours et manque de respect envers ses camarades.\n\nAprès plusieurs rappels à l'ordre restés sans effet, je vous prie d'intervenir et de convoquer les parents afin d'apporter une réponse éducative adaptée.\n\nVeuillez agréer mes salutations distinguées.",
    contentAr:
      "أخبركم أن التلميذ(ة) {eleve}، التابع(ة) لقسم {classe}{groupe}، يظهر سلوكا مزعجا خلال حصص مادة {matiere} (بتاريخ {date}): رفض العمل، تعطيل سير الحصة وعدم احترام الزملاء.\n\nوبعد عدة تنبيهات دون جدوى، أرجو من سيادتكم التدخل واستدعاء ولي الأمر من أجل تقديم جواب تربوي مناسب.\n\nوتفضلوا بقبول فائق الاحترام والتقدير.",
  },
];

/** Remplace les placeholders {..} d'un modèle par le contexte de la séance. */
export function fillTemplate(
  content: string,
  ctx: {
    eleve: string;
    classe: string;
    groupe: string; // "" si classe entière
    enseignant: string;
    matiere: string;
    date: string;
    absences: string | number;
    seuil: string | number;
  }
): string {
  return content
    .replaceAll("{eleve}", ctx.eleve)
    .replaceAll("{classe}", ctx.classe)
    .replaceAll("{groupe}", ctx.groupe)
    .replaceAll("{enseignant}", ctx.enseignant)
    .replaceAll("{matiere}", ctx.matiere)
    .replaceAll("{date}", ctx.date)
    .replaceAll("{absences}", String(ctx.absences))
    .replaceAll("{seuil}", String(ctx.seuil));
}
