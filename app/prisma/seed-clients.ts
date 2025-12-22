import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ClientData {
  timesheetCode: string;
  name: string;
  invoicedName: string | null;
  invoiceAttn: string | null;
  hourlyRate: number | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
}

// Status mapping: anything with "inactive", "liquidation" = INACTIVE, otherwise ACTIVE
function parseStatus(statusStr: string): "ACTIVE" | "INACTIVE" {
  const lower = statusStr.toLowerCase();
  if (lower.includes("inactive") || lower.includes("liquidation")) {
    return "INACTIVE";
  }
  return "ACTIVE";
}

// Clean email - take first email if multiple, return null if "n/a" or empty
function parseEmail(emailStr: string): string | null {
  if (!emailStr || emailStr.trim() === "" || emailStr.toLowerCase() === "n/a") {
    return null;
  }
  // Take first email if multiple (split by newline, comma, or space)
  const firstEmail = emailStr.split(/[\n,\s]+/)[0].trim();
  return firstEmail && firstEmail.includes("@") ? firstEmail : null;
}

// Parse hourly rate
function parseHourlyRate(rateStr: string): number | null {
  const rate = parseFloat(rateStr);
  return isNaN(rate) || rate === 0 ? null : rate;
}

const CLIENTS: ClientData[] = [
  { timesheetCode: "Assited Brains", name: "Assited Brains", invoicedName: "Assited Brains EOOD", invoiceAttn: "Iliya Valchanov", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "Audio Fusion Lab", name: "Audio Fusion Lab", invoicedName: "Audio Fusion Lab EOOD", invoiceAttn: "Maya Harrigan", hourlyRate: null, email: "mayadharrigan@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Awara", name: "Awara", invoicedName: "Awara IT Ltd", invoiceAttn: "Dmitrii Ignatiev", hourlyRate: 120, email: "Dmitry.Ignatiev@awara-it.com", status: "ACTIVE" },
  { timesheetCode: "Baringa", name: "Baringa", invoicedName: "Baringa Bulgaria EOOD", invoiceAttn: "Tracey Tahir", hourlyRate: 100, email: "Tracey.Tahir@baringa.com", status: "ACTIVE" },
  { timesheetCode: "Bookmark", name: "Bookmark", invoicedName: "Bookmark OOD", invoiceAttn: "Alexander Krastev", hourlyRate: 70, email: "alex@bookmark.bg", status: "ACTIVE" },
  { timesheetCode: "Camplight", name: "Camplight", invoicedName: "Camplight Coop", invoiceAttn: "Margarita Hristova", hourlyRate: 60, email: "margarita@camplight.net", status: "INACTIVE" },
  { timesheetCode: "Clubnode", name: "Clubnode", invoicedName: "Clubnode EOOD", invoiceAttn: "Timon Durand", hourlyRate: 80, email: "timon@clubnode.com", status: "INACTIVE" },
  { timesheetCode: "Coherent", name: "Coherent", invoicedName: "Coherent Solutions EOOD", invoiceAttn: "Боян Николов Антонов", hourlyRate: 110, email: "BoyanAntonov@coherentsolutions.com", status: "ACTIVE" },
  { timesheetCode: "Darrien David Kelly", name: "Darrien David Kelly", invoicedName: "Darrien David Kelly", invoiceAttn: "Darrien David Kelly", hourlyRate: 120, email: "c2secure@protonmail.com", status: "ACTIVE" },
  { timesheetCode: "EK Venture Labs", name: "EK Venture Labs", invoicedName: "EK Venture Labs OOD", invoiceAttn: "Eugeniy Kouumdjieff", hourlyRate: 60, email: "eugene@ek.ventures", status: "INACTIVE" },
  { timesheetCode: "Expertly Streamlined", name: "Expertly Streamlined", invoicedName: "Expertly Streamlined EOOD", invoiceAttn: "Pollyna Atanassova", hourlyRate: 70, email: "pollyna.atanassova@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Fees", name: "Fees", invoicedName: "VEDA Legal", invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { timesheetCode: "FM Music Studio", name: "FM Music Studio", invoicedName: "FM Music Studio EOOD", invoiceAttn: "Francesco Marzola", hourlyRate: 90, email: "francesco@marzolamusic.com", status: "ACTIVE" },
  { timesheetCode: "GridMetrics", name: "GridMetrics", invoicedName: "GridMetrics Ltd.", invoiceAttn: "БОЖИДАР ЙОВЧЕВ", hourlyRate: 100, email: "by@gridmetrics.co", status: "ACTIVE" },
  { timesheetCode: "Hedgehog", name: "Hedgehog", invoicedName: "Hedgehog Lab Bulgaria EOOD", invoiceAttn: "Mark Rogers", hourlyRate: 100, email: "mark.rogers@hedgehoglab.com", status: "ACTIVE" },
  { timesheetCode: "InspectHOA", name: "InspectHOA", invoicedName: "InspectHOA EOOD", invoiceAttn: "Bistra Atanassova", hourlyRate: 100, email: "bistra@inspecthoa.com", status: "ACTIVE" },
  { timesheetCode: "Jiminny", name: "Jiminny", invoicedName: "Jiminny Bulgaria EOOD", invoiceAttn: "Donal James Graham", hourlyRate: 100, email: "tzvetomira.lenkova@jiminny.com", status: "ACTIVE" },
  { timesheetCode: "Jlabs", name: "Jlabs", invoicedName: "Jlabs EOOD", invoiceAttn: "Ivaylov Ivanov", hourlyRate: 70, email: "office@j-labs.co", status: "ACTIVE" },
  { timesheetCode: "KAPSULA", name: "KAPSULA", invoicedName: "KAPSULA EOOD", invoiceAttn: "Siyana Dicheva", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "Katalysta", name: "Katalysta", invoicedName: "Katalysta OOD", invoiceAttn: "Dimitar Petkov", hourlyRate: 100, email: "dimitar@telerikacademy.com", status: "ACTIVE" },
  { timesheetCode: "Labsi", name: "Labsi", invoicedName: "Labsi OOD", invoiceAttn: "Ivan Ivanov", hourlyRate: null, email: null, status: "INACTIVE" },
  { timesheetCode: "Maple Bear", name: "Maple Bear", invoicedName: "Vantage Best in Class Advisors I AD", invoiceAttn: "Pavel Lekov", hourlyRate: 100, email: "pavel@vantagebestinclass.com", status: "INACTIVE" },
  { timesheetCode: "MarKam", name: "MarKam", invoicedName: "MarKam Solutions OOD", invoiceAttn: "Martin Ivanov", hourlyRate: 60, email: "kamen.krastev@markamsolutions.com", status: "ACTIVE" },
  { timesheetCode: "MTY", name: "MTY", invoicedName: "Mentor the Yound Foundation", invoiceAttn: "Alexander Gramatikov", hourlyRate: 60, email: "bulgaria@mentortheyoung.com", status: "ACTIVE" },
  { timesheetCode: "Nightingale Lab", name: "Nightingale Lab", invoicedName: "Nightingale Consulting EOOD", invoiceAttn: "Maria Silva", hourlyRate: 90, email: "maria@nightingalelab.io", status: "INACTIVE" },
  { timesheetCode: "Pet Mall", name: "Pet Mall", invoicedName: "Pet Mall OOD", invoiceAttn: "Nikola Ninov", hourlyRate: 60, email: "ninov@petmall.bg", status: "ACTIVE" },
  { timesheetCode: "PhoneArena", name: "PhoneArena", invoicedName: "PhoneArena АD", invoiceAttn: "Presiyan Karakostov", hourlyRate: 110, email: null, status: "INACTIVE" },
  { timesheetCode: "Pipehack", name: "Pipehack", invoicedName: "Pipehack EOOD", invoiceAttn: "Ognyan Sokolov", hourlyRate: 100, email: "ognyan.sokolov@pipehack.co", status: "INACTIVE" },
  { timesheetCode: "Polaris Software", name: "Polaris Software", invoicedName: "Polaris Software EOOD", invoiceAttn: "Rickard Martin Andersson", hourlyRate: 90, email: "rickard@severnatazvezda.com", status: "ACTIVE" },
  { timesheetCode: "Qredo", name: "Qredo", invoicedName: "Qredo Services EOOD", invoiceAttn: "Duncan Payne-Shelley", hourlyRate: 120, email: "sarah@zenrocklabs.io", status: "INACTIVE" },
  { timesheetCode: "ReachUP", name: "ReachUP", invoicedName: "ReachUP EOOD", invoiceAttn: "Stanimira Papazova", hourlyRate: 60, email: null, status: "INACTIVE" },
  { timesheetCode: "Renewable", name: "Renewable", invoicedName: "Renewable LTD.", invoiceAttn: "Nick Martyniuk", hourlyRate: 120, email: "nick@renewabl.com", status: "ACTIVE" },
  { timesheetCode: "r-tec", name: "r-tec", invoicedName: "r-tec IT Security – branch Bulgaria", invoiceAttn: "Erward Arz", hourlyRate: 100, email: "S.Freund@r-tec.net", status: "ACTIVE" },
  { timesheetCode: "Runa", name: "Runa", invoicedName: "RUNA NETWORK LTD", invoiceAttn: "Lucy Tonks", hourlyRate: 100, email: "lucy.tonks@runa.io", status: "ACTIVE" },
  { timesheetCode: "Selligence", name: "Selligence", invoicedName: "Selligence Technology BG EOOD", invoiceAttn: "Nick Vaughan", hourlyRate: 120, email: "d.carless@hamlynwilliams.com", status: "INACTIVE" },
  { timesheetCode: "SkillWork", name: "SkillWork", invoicedName: "Skillwork OOD", invoiceAttn: "Jan Gasiewski", hourlyRate: 120, email: "jan.gasiewski@skillwork.co", status: "ACTIVE" },
  { timesheetCode: "Software Supreme", name: "Software Supreme", invoicedName: "Software Supreme OOD", invoiceAttn: "Alexandar Soklev", hourlyRate: 70, email: "alex@software-supreme.com", status: "INACTIVE" },
  { timesheetCode: "Storyshell", name: "Storyshell", invoicedName: "Storyshell OOD", invoiceAttn: "Plamen Petkov", hourlyRate: 80, email: "plamen@petkoff.eu", status: "INACTIVE" },
  { timesheetCode: "Swift SaaS", name: "Swift SaaS", invoicedName: "SWIFT SAAS Ltd.", invoiceAttn: "George Mitsov", hourlyRate: 100, email: "george@proxyempire.io", status: "ACTIVE" },
  { timesheetCode: "Tagumani", name: "Tagumani", invoicedName: "Tagumani OOD", invoiceAttn: "Richard Clegg", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "TalentSight", name: "TalentSight", invoicedName: "TalentSight EOOD", invoiceAttn: "Todor Ranchev", hourlyRate: 100, email: "todor@talsight.com", status: "INACTIVE" },
  { timesheetCode: "Team-GPT", name: "Team-GPT", invoicedName: "Team-GPT OOD", invoiceAttn: "Iliya Valchanov", hourlyRate: 100, email: "katya@team-gpt.com", status: "ACTIVE" },
  { timesheetCode: "TwoGears", name: "TwoGears", invoicedName: "TwoGears EOOD", invoiceAttn: "Petar Petrov", hourlyRate: null, email: null, status: "INACTIVE" },
  { timesheetCode: "VEDA Accounting", name: "VEDA Accounting", invoicedName: "VEDA Accounting OOD", invoiceAttn: "Danail Koev", hourlyRate: 50, email: null, status: "ACTIVE" },
  { timesheetCode: "VEDA Legal", name: "VEDA Legal", invoicedName: "VEDA Legal", invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { timesheetCode: "VEDA Payroll", name: "VEDA Payroll", invoicedName: null, invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { timesheetCode: "ZonGuru", name: "ZonGuru", invoicedName: "ZonGuru Bulgaria EOOD", invoiceAttn: "Stefan Ratchev", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "Virtuopay", name: "Virtuopay", invoicedName: "Payconsulting SL", invoiceAttn: "Eugenio Calderon", hourlyRate: 135, email: "eugenio@virtuopay.com", status: "ACTIVE" },
  { timesheetCode: "Voxxy", name: "Voxxy", invoicedName: "Voxxy BG OOD", invoiceAttn: "William Benjamin Field", hourlyRate: 100, email: "billy@voxxyworld.com", status: "INACTIVE" },
  { timesheetCode: "Efosoft", name: "Efosoft", invoicedName: "Efosoft EOOD", invoiceAttn: "Alexandru-Iustin Dochioiu", hourlyRate: 135, email: "alex@dochioiu.com", status: "ACTIVE" },
  { timesheetCode: "Hack Soft", name: "Hack Soft", invoicedName: "Hack Soft EOOD", invoiceAttn: "Radoslav Georgiev", hourlyRate: 135, email: "radorado@hacksoft.io", status: "ACTIVE" },
  { timesheetCode: "Velantix", name: "Velantix", invoicedName: "Velantix EOOD", invoiceAttn: "Alexander Todorov", hourlyRate: 100, email: "alex@velantix.com", status: "ACTIVE" },
  { timesheetCode: "in3D", name: "in3D", invoicedName: "in3D EOOD", invoiceAttn: "Sergey Sherman", hourlyRate: null, email: "kate@in3d.io", status: "INACTIVE" },
  { timesheetCode: "Arkenbit/tinker", name: "Arkenbit/tinker", invoicedName: "Arkenbit OOD", invoiceAttn: "Doncho Karaivanov", hourlyRate: 100, email: "doni.karaivanov@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Thinkpilot", name: "Thinkpilot", invoicedName: "Thinkpilot OOD", invoiceAttn: "Stoimen Veselinov", hourlyRate: 100, email: "stoimen@thinkpilot.co", status: "ACTIVE" },
  { timesheetCode: "Little Vitamin", name: "Little Vitamin", invoicedName: "Little Vitamin EOOD", invoiceAttn: "Jacob William Harry Becket", hourlyRate: 100, email: "dan@multivitamin.studio", status: "INACTIVE" },
  { timesheetCode: "A couple of friends", name: "A couple of friends", invoicedName: "A Couple of Friends Ltd.", invoiceAttn: "Nadezhda Petrova", hourlyRate: 100, email: "nadezhda.petrova@hotmail.com", status: "ACTIVE" },
  { timesheetCode: "Aifnet", name: "Aifnet", invoicedName: "Aifnet Ltd", invoiceAttn: "Kaloyan Chernev", hourlyRate: 100, email: "kaloyan.chernev@aifnet.com", status: "ACTIVE" },
  { timesheetCode: "Tau-Gen", name: "Tau-Gen", invoicedName: "Tau-Gen OOD", invoiceAttn: "Olga Borisova", hourlyRate: 100, email: "olga.borisova@tau-gen.com", status: "INACTIVE" },
  { timesheetCode: "Claimcompass", name: "Claimcompass", invoicedName: "Claimcompass EOOD", invoiceAttn: "Tatyana Mitkova", hourlyRate: 100, email: "tatyana.mitkova@claimcompass.eu", status: "INACTIVE" },
  { timesheetCode: "RMH Pos", name: "RMH Pos", invoicedName: "RMH Pos (in incorporation)", invoiceAttn: "Anastas Daskalov", hourlyRate: 100, email: "lisa@rmhpos.com", status: "ACTIVE" },
  { timesheetCode: "Nik-electronics", name: "Nik-electronics", invoicedName: "Nik Electronics OOD", invoiceAttn: "Ivo Kumanov", hourlyRate: 110, email: "daniela.nenova@nik.group", status: "ACTIVE" },
  { timesheetCode: "Foundation Shared Parenting", name: "Foundation Shared Parenting", invoicedName: "Foundation Shared Parenting", invoiceAttn: "Slavi Nestorov", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "ImgSearch DPK", name: "ImgSearch DPK", invoicedName: "ImgSearch DPK", invoiceAttn: "Kaloyan Chernev", hourlyRate: 100, email: null, status: "ACTIVE" },
  { timesheetCode: "C.O.P.", name: "C.O.P.", invoicedName: null, invoiceAttn: "Taemin Huang", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "Popara", name: "Popara", invoicedName: null, invoiceAttn: "Boyan Stoyanov", hourlyRate: 100, email: null, status: "INACTIVE" },
  { timesheetCode: "Ratio", name: "Ratio", invoicedName: null, invoiceAttn: "Lyubomir Baburov", hourlyRate: 100, email: "baburov@ratio.bg", status: "INACTIVE" },
  { timesheetCode: "Found Recruitment", name: "Found Recruitment", invoicedName: null, invoiceAttn: "Momchil Dochev", hourlyRate: 100, email: "alex@found-rg.com", status: "INACTIVE" },
  { timesheetCode: "TUES", name: "TUES", invoicedName: null, invoiceAttn: "Kirilka Angelova", hourlyRate: 100, email: "adriana.panayotova@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Programmatic", name: "Programmatic", invoicedName: null, invoiceAttn: "Kalina Tonkovska", hourlyRate: 100, email: "kalina@programmatic.law", status: "INACTIVE" },
  { timesheetCode: "Cecily Group", name: "Cecily Group", invoicedName: null, invoiceAttn: "Nicola Schwartz", hourlyRate: 100, email: "elena@thececilygroup.com", status: "INACTIVE" },
  { timesheetCode: "37", name: "37", invoicedName: null, invoiceAttn: "Stefani Todorova", hourlyRate: 110, email: "stefani@jarvis.exchange", status: "ACTIVE" },
  { timesheetCode: "Bonev Holding", name: "Bonev Holding", invoicedName: null, invoiceAttn: "Nikolay Bonev", hourlyRate: 100, email: "nbonev@duck.com", status: "INACTIVE" },
  { timesheetCode: "Iteracto", name: "Iteracto", invoicedName: null, invoiceAttn: "Zlatomir Haralambov", hourlyRate: 100, email: "z.haralambov@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Zipchat", name: "Zipchat", invoicedName: null, invoiceAttn: "Ruslan Leteiski", hourlyRate: 100, email: "ruslan@zipchat.ai", status: "ACTIVE" },
  { timesheetCode: "Trevor", name: "Trevor", invoicedName: null, invoiceAttn: "Georgi Petrov", hourlyRate: 70, email: "george@trevorlabs.com", status: "ACTIVE" },
  { timesheetCode: "Dekavet", name: "Dekavet", invoicedName: null, invoiceAttn: "Denitsa Kasabova", hourlyRate: 80, email: null, status: "INACTIVE" },
  { timesheetCode: "Future Unicorns", name: "Future Unicorns", invoicedName: null, invoiceAttn: "Konstantin Kunev", hourlyRate: null, email: "konstantin@bghub.io", status: "ACTIVE" },
  { timesheetCode: "PolygrAI", name: "PolygrAI", invoicedName: null, invoiceAttn: "Asen Levov", hourlyRate: 100, email: "asenlevov@gmail.com", status: "INACTIVE" },
  { timesheetCode: "Finrax", name: "Finrax", invoicedName: null, invoiceAttn: "Yordan", hourlyRate: 115, email: "yordan@finrax.com", status: "INACTIVE" },
  { timesheetCode: "Assetblaze", name: "Assetblaze", invoicedName: null, invoiceAttn: "Mark Rogers", hourlyRate: null, email: "mark@assetblaze.com", status: "ACTIVE" },
  { timesheetCode: "Stamena Consulting", name: "Stamena Consulting", invoicedName: null, invoiceAttn: "Radka Vasileva", hourlyRate: null, email: "radka.vasileva@gmail.com", status: "ACTIVE" },
  { timesheetCode: "i3Services", name: "i3Services", invoicedName: null, invoiceAttn: "Ivan Ivanov", hourlyRate: null, email: "ivan.igt.ivanov@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Several Clouds", name: "Several Clouds", invoicedName: null, invoiceAttn: "Daniel Rankov", hourlyRate: null, email: "daniel@severalclouds.com", status: "ACTIVE" },
  { timesheetCode: "RXTX", name: "RXTX", invoicedName: null, invoiceAttn: "Atanas Zaprianov", hourlyRate: null, email: "azaprianov@googlemail.com", status: "ACTIVE" },
  { timesheetCode: "Mamba Technology", name: "Mamba Technology", invoicedName: null, invoiceAttn: "Antonio Todorov", hourlyRate: null, email: "todorov.antonio@yahoo.com", status: "ACTIVE" },
  { timesheetCode: "Triple Jump Technologies", name: "Triple Jump Technologies", invoicedName: null, invoiceAttn: "Tal Baron", hourlyRate: null, email: "tal@triplejumptech.com", status: "ACTIVE" },
  { timesheetCode: "Georgi Lazarov", name: "Georgi Lazarov", invoicedName: "Georgi Lazarov", invoiceAttn: "Georgi Lazarov", hourlyRate: null, email: "glazarov95@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Golyamoto Bongo", name: "Golyamoto Bongo", invoicedName: null, invoiceAttn: "Petar Petrov", hourlyRate: null, email: "p@soulandsilicon.ai", status: "ACTIVE" },
  { timesheetCode: "Partnerships", name: "Partnerships", invoicedName: null, invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { timesheetCode: "Atman", name: "Atman", invoicedName: null, invoiceAttn: "Teodor Terziev", hourlyRate: null, email: null, status: "ACTIVE" },
  { timesheetCode: "Datamarket", name: "Datamarket", invoicedName: null, invoiceAttn: "Philip Totin", hourlyRate: null, email: "philip.totin@datamarket.com.tr", status: "ACTIVE" },
  { timesheetCode: "RVM Systems", name: "RVM Systems", invoicedName: null, invoiceAttn: "Tord Nybleus", hourlyRate: null, email: "Tord.Nybleus@rvmsystems.com", status: "ACTIVE" },
  { timesheetCode: "BRAVETECH", name: "BRAVETECH", invoicedName: null, invoiceAttn: null, hourlyRate: null, email: "g.vorobyov@netpeak.net", status: "ACTIVE" },
  { timesheetCode: "Hristo Hursev", name: "Hristo Hursev", invoicedName: null, invoiceAttn: "Hristo Hursev", hourlyRate: null, email: null, status: "ACTIVE" },
  { timesheetCode: "Brandoria", name: "Brandoria", invoicedName: null, invoiceAttn: "Tsvetelina Georgieva", hourlyRate: null, email: "tsvetelina19@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Traffic Hack", name: "Traffic Hack", invoicedName: null, invoiceAttn: "Tihomir Spasov", hourlyRate: null, email: "tih.spasov@gmail.com", status: "ACTIVE" },
  { timesheetCode: "EuroViraGene", name: "EuroViraGene", invoicedName: null, invoiceAttn: "Mehdi Totonchi", hourlyRate: null, email: "totonchimehdi@gmail.com", status: "ACTIVE" },
  { timesheetCode: "Mitev Tech", name: "Mitev Tech", invoicedName: null, invoiceAttn: "Nikola Mitev", hourlyRate: null, email: "nik@mitev.net", status: "ACTIVE" },
  { timesheetCode: "Postworks", name: "Postworks", invoicedName: null, invoiceAttn: "Nikki Dingle", hourlyRate: null, email: "nikki.dingle@postworks.co.uk", status: "ACTIVE" },
];

async function main() {
  console.log("Seeding clients...");
  console.log(`Total clients to seed: ${CLIENTS.length}`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const clientData of CLIENTS) {
    try {
      // Try to upsert - update if exists (by timesheetCode), create if not
      await prisma.client.upsert({
        where: { timesheetCode: clientData.timesheetCode },
        update: {
          name: clientData.name,
          invoicedName: clientData.invoicedName,
          invoiceAttn: clientData.invoiceAttn,
          hourlyRate: clientData.hourlyRate,
          email: clientData.email,
          status: clientData.status,
        },
        create: {
          timesheetCode: clientData.timesheetCode,
          name: clientData.name,
          invoicedName: clientData.invoicedName,
          invoiceAttn: clientData.invoiceAttn,
          hourlyRate: clientData.hourlyRate,
          email: clientData.email,
          status: clientData.status,
        },
      });
      created++;
    } catch (error) {
      console.error(`Error with client ${clientData.timesheetCode}:`, error);
      errors++;
    }
  }

  console.log(`\nSeeding complete!`);
  console.log(`  Created/Updated: ${created}`);
  console.log(`  Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
