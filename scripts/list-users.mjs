// scripts/list-users.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ log: ['error'] })
const rows = await prisma.user.findMany({
  select: { id: true, name: true, email: true, createdAt: true },
  orderBy: { createdAt: 'asc' },
})
for (const r of rows) console.log(JSON.stringify(r))
await prisma.$disconnect()
