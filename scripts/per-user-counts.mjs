// scripts/per-user-counts.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ log: ['error'] })

const ids = [
  '0aaa6f08-1afe-44dd-a4ac-9f1775b5773f',
  '26918604-fef2-4bdb-aef7-61b2a8adf862',
  'cc12d42a-10a1-4675-bf72-195d45fe0577',
]

const tables = ['userShift','userTemplate','expense','expenseCategory','userBudgetMonthMeta','userBudgetGoal','userJob']

const out = await Promise.all(ids.map(async (id, i) => {
  const counts = {}
  for (const t of tables) {
    try { counts[t] = await prisma[t].count({ where: { userId: id } }) }
    catch { counts[t] = '-' }
  }
  return { user: i, id, ...counts }
}))
console.table(out)
await prisma.$disconnect()
