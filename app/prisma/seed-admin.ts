import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminUser = await prisma.user.upsert({
    where: { email: "stefan@veda.legal" },
    update: {
      position: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      email: "stefan@veda.legal",
      name: "Stefan Ratchev",
      position: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Admin user created/updated:", adminUser);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
