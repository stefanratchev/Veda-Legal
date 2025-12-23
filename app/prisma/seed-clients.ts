import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ClientData {
  name: string;
  invoicedName: string | null;
  invoiceAttn: string | null;
  hourlyRate: number | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
}

const CLIENTS: ClientData[] = [
  { name: "Assited Brains", invoicedName: "Assited Brains EOOD", invoiceAttn: "Iliya Valchanov", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "Audio Fusion Lab", invoicedName: "Audio Fusion Lab EOOD", invoiceAttn: "Maya Harrigan", hourlyRate: null, email: "mayadharrigan@gmail.com", status: "ACTIVE" },
  { name: "Awara", invoicedName: "Awara IT Ltd", invoiceAttn: "Dmitrii Ignatiev", hourlyRate: 120, email: "Dmitry.Ignatiev@awara-it.com", status: "ACTIVE" },
  { name: "Baringa", invoicedName: "Baringa Bulgaria EOOD", invoiceAttn: "Tracey Tahir", hourlyRate: 100, email: "Tracey.Tahir@baringa.com", status: "ACTIVE" },
  { name: "Bookmark", invoicedName: "Bookmark OOD", invoiceAttn: "Alexander Krastev", hourlyRate: 70, email: "alex@bookmark.bg", status: "ACTIVE" },
  { name: "Camplight", invoicedName: "Camplight Coop", invoiceAttn: "Margarita Hristova", hourlyRate: 60, email: "margarita@camplight.net", status: "INACTIVE" },
  { name: "Clubnode", invoicedName: "Clubnode EOOD", invoiceAttn: "Timon Durand", hourlyRate: 80, email: "timon@clubnode.com", status: "INACTIVE" },
  { name: "Coherent", invoicedName: "Coherent Solutions EOOD", invoiceAttn: "Боян Николов Антонов", hourlyRate: 110, email: "BoyanAntonov@coherentsolutions.com", status: "ACTIVE" },
  { name: "Darrien David Kelly", invoicedName: "Darrien David Kelly", invoiceAttn: "Darrien David Kelly", hourlyRate: 120, email: "c2secure@protonmail.com", status: "ACTIVE" },
  { name: "EK Venture Labs", invoicedName: "EK Venture Labs OOD", invoiceAttn: "Eugeniy Kouumdjieff", hourlyRate: 60, email: "eugene@ek.ventures", status: "INACTIVE" },
  { name: "Expertly Streamlined", invoicedName: "Expertly Streamlined EOOD", invoiceAttn: "Pollyna Atanassova", hourlyRate: 70, email: "pollyna.atanassova@gmail.com", status: "ACTIVE" },
  { name: "Fees", invoicedName: "VEDA Legal", invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { name: "FM Music Studio", invoicedName: "FM Music Studio EOOD", invoiceAttn: "Francesco Marzola", hourlyRate: 90, email: "francesco@marzolamusic.com", status: "ACTIVE" },
  { name: "GridMetrics", invoicedName: "GridMetrics Ltd.", invoiceAttn: "БОЖИДАР ЙОВЧЕВ", hourlyRate: 100, email: "by@gridmetrics.co", status: "ACTIVE" },
  { name: "Hedgehog", invoicedName: "Hedgehog Lab Bulgaria EOOD", invoiceAttn: "Mark Rogers", hourlyRate: 100, email: "mark.rogers@hedgehoglab.com", status: "ACTIVE" },
  { name: "InspectHOA", invoicedName: "InspectHOA EOOD", invoiceAttn: "Bistra Atanassova", hourlyRate: 100, email: "bistra@inspecthoa.com", status: "ACTIVE" },
  { name: "Jiminny", invoicedName: "Jiminny Bulgaria EOOD", invoiceAttn: "Donal James Graham", hourlyRate: 100, email: "tzvetomira.lenkova@jiminny.com", status: "ACTIVE" },
  { name: "Jlabs", invoicedName: "Jlabs EOOD", invoiceAttn: "Ivaylov Ivanov", hourlyRate: 70, email: "office@j-labs.co", status: "ACTIVE" },
  { name: "KAPSULA", invoicedName: "KAPSULA EOOD", invoiceAttn: "Siyana Dicheva", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "Katalysta", invoicedName: "Katalysta OOD", invoiceAttn: "Dimitar Petkov", hourlyRate: 100, email: "dimitar@telerikacademy.com", status: "ACTIVE" },
  { name: "Labsi", invoicedName: "Labsi OOD", invoiceAttn: "Ivan Ivanov", hourlyRate: null, email: null, status: "INACTIVE" },
  { name: "Maple Bear", invoicedName: "Vantage Best in Class Advisors I AD", invoiceAttn: "Pavel Lekov", hourlyRate: 100, email: "pavel@vantagebestinclass.com", status: "INACTIVE" },
  { name: "MarKam", invoicedName: "MarKam Solutions OOD", invoiceAttn: "Martin Ivanov", hourlyRate: 60, email: "kamen.krastev@markamsolutions.com", status: "ACTIVE" },
  { name: "MTY", invoicedName: "Mentor the Yound Foundation", invoiceAttn: "Alexander Gramatikov", hourlyRate: 60, email: "bulgaria@mentortheyoung.com", status: "ACTIVE" },
  { name: "Nightingale Lab", invoicedName: "Nightingale Consulting EOOD", invoiceAttn: "Maria Silva", hourlyRate: 90, email: "maria@nightingalelab.io", status: "INACTIVE" },
  { name: "Pet Mall", invoicedName: "Pet Mall OOD", invoiceAttn: "Nikola Ninov", hourlyRate: 60, email: "ninov@petmall.bg", status: "ACTIVE" },
  { name: "PhoneArena", invoicedName: "PhoneArena АD", invoiceAttn: "Presiyan Karakostov", hourlyRate: 110, email: null, status: "INACTIVE" },
  { name: "Pipehack", invoicedName: "Pipehack EOOD", invoiceAttn: "Ognyan Sokolov", hourlyRate: 100, email: "ognyan.sokolov@pipehack.co", status: "INACTIVE" },
  { name: "Polaris Software", invoicedName: "Polaris Software EOOD", invoiceAttn: "Rickard Martin Andersson", hourlyRate: 90, email: "rickard@severnatazvezda.com", status: "ACTIVE" },
  { name: "Qredo", invoicedName: "Qredo Services EOOD", invoiceAttn: "Duncan Payne-Shelley", hourlyRate: 120, email: "sarah@zenrocklabs.io", status: "INACTIVE" },
  { name: "ReachUP", invoicedName: "ReachUP EOOD", invoiceAttn: "Stanimira Papazova", hourlyRate: 60, email: null, status: "INACTIVE" },
  { name: "Renewable", invoicedName: "Renewable LTD.", invoiceAttn: "Nick Martyniuk", hourlyRate: 120, email: "nick@renewabl.com", status: "ACTIVE" },
  { name: "r-tec", invoicedName: "r-tec IT Security – branch Bulgaria", invoiceAttn: "Erward Arz", hourlyRate: 100, email: "S.Freund@r-tec.net", status: "ACTIVE" },
  { name: "Runa", invoicedName: "RUNA NETWORK LTD", invoiceAttn: "Lucy Tonks", hourlyRate: 100, email: "lucy.tonks@runa.io", status: "ACTIVE" },
  { name: "Selligence", invoicedName: "Selligence Technology BG EOOD", invoiceAttn: "Nick Vaughan", hourlyRate: 120, email: "d.carless@hamlynwilliams.com", status: "INACTIVE" },
  { name: "SkillWork", invoicedName: "Skillwork OOD", invoiceAttn: "Jan Gasiewski", hourlyRate: 120, email: "jan.gasiewski@skillwork.co", status: "ACTIVE" },
  { name: "Software Supreme", invoicedName: "Software Supreme OOD", invoiceAttn: "Alexandar Soklev", hourlyRate: 70, email: "alex@software-supreme.com", status: "INACTIVE" },
  { name: "Storyshell", invoicedName: "Storyshell OOD", invoiceAttn: "Plamen Petkov", hourlyRate: 80, email: "plamen@petkoff.eu", status: "INACTIVE" },
  { name: "Swift SaaS", invoicedName: "SWIFT SAAS Ltd.", invoiceAttn: "George Mitsov", hourlyRate: 100, email: "george@proxyempire.io", status: "ACTIVE" },
  { name: "Tagumani", invoicedName: "Tagumani OOD", invoiceAttn: "Richard Clegg", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "TalentSight", invoicedName: "TalentSight EOOD", invoiceAttn: "Todor Ranchev", hourlyRate: 100, email: "todor@talsight.com", status: "INACTIVE" },
  { name: "Team-GPT", invoicedName: "Team-GPT OOD", invoiceAttn: "Iliya Valchanov", hourlyRate: 100, email: "katya@team-gpt.com", status: "ACTIVE" },
  { name: "TwoGears", invoicedName: "TwoGears EOOD", invoiceAttn: "Petar Petrov", hourlyRate: null, email: null, status: "INACTIVE" },
  { name: "VEDA Accounting", invoicedName: "VEDA Accounting OOD", invoiceAttn: "Danail Koev", hourlyRate: 50, email: null, status: "ACTIVE" },
  { name: "VEDA Legal", invoicedName: "VEDA Legal", invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { name: "VEDA Payroll", invoicedName: null, invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { name: "ZonGuru", invoicedName: "ZonGuru Bulgaria EOOD", invoiceAttn: "Stefan Ratchev", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "Virtuopay", invoicedName: "Payconsulting SL", invoiceAttn: "Eugenio Calderon", hourlyRate: 135, email: "eugenio@virtuopay.com", status: "ACTIVE" },
  { name: "Voxxy", invoicedName: "Voxxy BG OOD", invoiceAttn: "William Benjamin Field", hourlyRate: 100, email: "billy@voxxyworld.com", status: "INACTIVE" },
  { name: "Efosoft", invoicedName: "Efosoft EOOD", invoiceAttn: "Alexandru-Iustin Dochioiu", hourlyRate: 135, email: "alex@dochioiu.com", status: "ACTIVE" },
  { name: "Hack Soft", invoicedName: "Hack Soft EOOD", invoiceAttn: "Radoslav Georgiev", hourlyRate: 135, email: "radorado@hacksoft.io", status: "ACTIVE" },
  { name: "Velantix", invoicedName: "Velantix EOOD", invoiceAttn: "Alexander Todorov", hourlyRate: 100, email: "alex@velantix.com", status: "ACTIVE" },
  { name: "in3D", invoicedName: "in3D EOOD", invoiceAttn: "Sergey Sherman", hourlyRate: null, email: "kate@in3d.io", status: "INACTIVE" },
  { name: "Arkenbit/tinker", invoicedName: "Arkenbit OOD", invoiceAttn: "Doncho Karaivanov", hourlyRate: 100, email: "doni.karaivanov@gmail.com", status: "ACTIVE" },
  { name: "Thinkpilot", invoicedName: "Thinkpilot OOD", invoiceAttn: "Stoimen Veselinov", hourlyRate: 100, email: "stoimen@thinkpilot.co", status: "ACTIVE" },
  { name: "Little Vitamin", invoicedName: "Little Vitamin EOOD", invoiceAttn: "Jacob William Harry Becket", hourlyRate: 100, email: "dan@multivitamin.studio", status: "INACTIVE" },
  { name: "A couple of friends", invoicedName: "A Couple of Friends Ltd.", invoiceAttn: "Nadezhda Petrova", hourlyRate: 100, email: "nadezhda.petrova@hotmail.com", status: "ACTIVE" },
  { name: "Aifnet", invoicedName: "Aifnet Ltd", invoiceAttn: "Kaloyan Chernev", hourlyRate: 100, email: "kaloyan.chernev@aifnet.com", status: "ACTIVE" },
  { name: "Tau-Gen", invoicedName: "Tau-Gen OOD", invoiceAttn: "Olga Borisova", hourlyRate: 100, email: "olga.borisova@tau-gen.com", status: "INACTIVE" },
  { name: "Claimcompass", invoicedName: "Claimcompass EOOD", invoiceAttn: "Tatyana Mitkova", hourlyRate: 100, email: "tatyana.mitkova@claimcompass.eu", status: "INACTIVE" },
  { name: "RMH Pos", invoicedName: "RMH Pos (in incorporation)", invoiceAttn: "Anastas Daskalov", hourlyRate: 100, email: "lisa@rmhpos.com", status: "ACTIVE" },
  { name: "Nik-electronics", invoicedName: "Nik Electronics OOD", invoiceAttn: "Ivo Kumanov", hourlyRate: 110, email: "daniela.nenova@nik.group", status: "ACTIVE" },
  { name: "Foundation Shared Parenting", invoicedName: "Foundation Shared Parenting", invoiceAttn: "Slavi Nestorov", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "ImgSearch DPK", invoicedName: "ImgSearch DPK", invoiceAttn: "Kaloyan Chernev", hourlyRate: 100, email: null, status: "ACTIVE" },
  { name: "C.O.P.", invoicedName: null, invoiceAttn: "Taemin Huang", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "Popara", invoicedName: null, invoiceAttn: "Boyan Stoyanov", hourlyRate: 100, email: null, status: "INACTIVE" },
  { name: "Ratio", invoicedName: null, invoiceAttn: "Lyubomir Baburov", hourlyRate: 100, email: "baburov@ratio.bg", status: "INACTIVE" },
  { name: "Found Recruitment", invoicedName: null, invoiceAttn: "Momchil Dochev", hourlyRate: 100, email: "alex@found-rg.com", status: "INACTIVE" },
  { name: "TUES", invoicedName: null, invoiceAttn: "Kirilka Angelova", hourlyRate: 100, email: "adriana.panayotova@gmail.com", status: "ACTIVE" },
  { name: "Programmatic", invoicedName: null, invoiceAttn: "Kalina Tonkovska", hourlyRate: 100, email: "kalina@programmatic.law", status: "INACTIVE" },
  { name: "Cecily Group", invoicedName: null, invoiceAttn: "Nicola Schwartz", hourlyRate: 100, email: "elena@thececilygroup.com", status: "INACTIVE" },
  { name: "37", invoicedName: null, invoiceAttn: "Stefani Todorova", hourlyRate: 110, email: "stefani@jarvis.exchange", status: "ACTIVE" },
  { name: "Bonev Holding", invoicedName: null, invoiceAttn: "Nikolay Bonev", hourlyRate: 100, email: "nbonev@duck.com", status: "INACTIVE" },
  { name: "Iteracto", invoicedName: null, invoiceAttn: "Zlatomir Haralambov", hourlyRate: 100, email: "z.haralambov@gmail.com", status: "ACTIVE" },
  { name: "Zipchat", invoicedName: null, invoiceAttn: "Ruslan Leteiski", hourlyRate: 100, email: "ruslan@zipchat.ai", status: "ACTIVE" },
  { name: "Trevor", invoicedName: null, invoiceAttn: "Georgi Petrov", hourlyRate: 70, email: "george@trevorlabs.com", status: "ACTIVE" },
  { name: "Dekavet", invoicedName: null, invoiceAttn: "Denitsa Kasabova", hourlyRate: 80, email: null, status: "INACTIVE" },
  { name: "Future Unicorns", invoicedName: null, invoiceAttn: "Konstantin Kunev", hourlyRate: null, email: "konstantin@bghub.io", status: "ACTIVE" },
  { name: "PolygrAI", invoicedName: null, invoiceAttn: "Asen Levov", hourlyRate: 100, email: "asenlevov@gmail.com", status: "INACTIVE" },
  { name: "Finrax", invoicedName: null, invoiceAttn: "Yordan", hourlyRate: 115, email: "yordan@finrax.com", status: "INACTIVE" },
  { name: "Assetblaze", invoicedName: null, invoiceAttn: "Mark Rogers", hourlyRate: null, email: "mark@assetblaze.com", status: "ACTIVE" },
  { name: "Stamena Consulting", invoicedName: null, invoiceAttn: "Radka Vasileva", hourlyRate: null, email: "radka.vasileva@gmail.com", status: "ACTIVE" },
  { name: "i3Services", invoicedName: null, invoiceAttn: "Ivan Ivanov", hourlyRate: null, email: "ivan.igt.ivanov@gmail.com", status: "ACTIVE" },
  { name: "Several Clouds", invoicedName: null, invoiceAttn: "Daniel Rankov", hourlyRate: null, email: "daniel@severalclouds.com", status: "ACTIVE" },
  { name: "RXTX", invoicedName: null, invoiceAttn: "Atanas Zaprianov", hourlyRate: null, email: "azaprianov@googlemail.com", status: "ACTIVE" },
  { name: "Mamba Technology", invoicedName: null, invoiceAttn: "Antonio Todorov", hourlyRate: null, email: "todorov.antonio@yahoo.com", status: "ACTIVE" },
  { name: "Triple Jump Technologies", invoicedName: null, invoiceAttn: "Tal Baron", hourlyRate: null, email: "tal@triplejumptech.com", status: "ACTIVE" },
  { name: "Georgi Lazarov", invoicedName: "Georgi Lazarov", invoiceAttn: "Georgi Lazarov", hourlyRate: null, email: "glazarov95@gmail.com", status: "ACTIVE" },
  { name: "Golyamoto Bongo", invoicedName: null, invoiceAttn: "Petar Petrov", hourlyRate: null, email: "p@soulandsilicon.ai", status: "ACTIVE" },
  { name: "Partnerships", invoicedName: null, invoiceAttn: null, hourlyRate: null, email: null, status: "ACTIVE" },
  { name: "Atman", invoicedName: null, invoiceAttn: "Teodor Terziev", hourlyRate: null, email: null, status: "ACTIVE" },
  { name: "Datamarket", invoicedName: null, invoiceAttn: "Philip Totin", hourlyRate: null, email: "philip.totin@datamarket.com.tr", status: "ACTIVE" },
  { name: "RVM Systems", invoicedName: null, invoiceAttn: "Tord Nybleus", hourlyRate: null, email: "Tord.Nybleus@rvmsystems.com", status: "ACTIVE" },
  { name: "BRAVETECH", invoicedName: null, invoiceAttn: null, hourlyRate: null, email: "g.vorobyov@netpeak.net", status: "ACTIVE" },
  { name: "Hristo Hursev", invoicedName: null, invoiceAttn: "Hristo Hursev", hourlyRate: null, email: null, status: "ACTIVE" },
  { name: "Brandoria", invoicedName: null, invoiceAttn: "Tsvetelina Georgieva", hourlyRate: null, email: "tsvetelina19@gmail.com", status: "ACTIVE" },
  { name: "Traffic Hack", invoicedName: null, invoiceAttn: "Tihomir Spasov", hourlyRate: null, email: "tih.spasov@gmail.com", status: "ACTIVE" },
  { name: "EuroViraGene", invoicedName: null, invoiceAttn: "Mehdi Totonchi", hourlyRate: null, email: "totonchimehdi@gmail.com", status: "ACTIVE" },
  { name: "Mitev Tech", invoicedName: null, invoiceAttn: "Nikola Mitev", hourlyRate: null, email: "nik@mitev.net", status: "ACTIVE" },
  { name: "Postworks", invoicedName: null, invoiceAttn: "Nikki Dingle", hourlyRate: null, email: "nikki.dingle@postworks.co.uk", status: "ACTIVE" },
];

async function main() {
  console.log("Seeding clients...");
  console.log(`Total clients to seed: ${CLIENTS.length}`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const clientData of CLIENTS) {
    try {
      // Find existing client by name, update if exists, create if not
      const existing = await prisma.client.findFirst({
        where: { name: clientData.name },
      });

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            invoicedName: clientData.invoicedName,
            invoiceAttn: clientData.invoiceAttn,
            hourlyRate: clientData.hourlyRate,
            email: clientData.email,
            status: clientData.status,
          },
        });
        updated++;
      } else {
        await prisma.client.create({
          data: {
            name: clientData.name,
            invoicedName: clientData.invoicedName,
            invoiceAttn: clientData.invoiceAttn,
            hourlyRate: clientData.hourlyRate,
            email: clientData.email,
            status: clientData.status,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error with client ${clientData.name}:`, error);
      errors++;
    }
  }

  console.log(`\nSeeding complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
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
