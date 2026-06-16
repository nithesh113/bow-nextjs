'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────
export interface CategoryData {
  id: string
  name: string
  icon: string
  budget: number
  parentId: string | null
  sortOrder: number
  createdAt: string
  children: CategoryData[]
}

export interface ExpenseData {
  id: string
  categoryId: string
  subcategoryId: string | null
  amount: number
  date: string
  note: string
  categoryName: string
  categoryIcon: string
  subcategoryName: string | null
  subcategoryIcon: string | null
  createdAt: string
}

// ── Default categories to seed ─────────────────────
const DEFAULT_CATEGORIES = [
  {
    name: 'Food', icon: '🍜', children: [
      { name: 'Snacks', icon: '🍿' },
      { name: 'Lunch', icon: '🍛' },
      { name: 'Dinner', icon: '🍕' },
      { name: 'Drinks', icon: '🥤' },
      { name: 'Fruits', icon: '🍌' },
    ]
  },
  {
    name: 'Transport', icon: '🚕', children: [
      { name: 'Train', icon: '🚆' },
      { name: 'Bus', icon: '🚌' },
      { name: 'Taxi', icon: '🚖' },
    ]
  },
  {
    name: 'Shopping', icon: '🛍️', children: [
      { name: 'Clothes', icon: '👕' },
      { name: 'Electronics', icon: '📱' },
      { name: 'Household', icon: '🏠' },
      { name: 'Groceries', icon: '🛒' },
    ]
  },
  {
    name: 'Entertainment', icon: '🎮', children: [
      { name: 'Movies', icon: '🎬' },
      { name: 'Music', icon: '🎵' },
      { name: 'Games', icon: '🎮' },
    ]
  },
  {
    name: 'Utilities', icon: '💡', children: [
      { name: 'Electricity', icon: '⚡' },
      { name: 'Water', icon: '💧' },
      { name: 'Phone', icon: '📱' },
      { name: 'Internet', icon: '🌐' },
    ]
  },
  {
    name: 'Health', icon: '⚕️', children: [
      { name: 'Medicine', icon: '💊' },
      { name: 'Doctor', icon: '🏥' },
      { name: 'Dental', icon: '🦷' },
    ]
  },
  {
    name: 'School', icon: '📚', children: [
      { name: 'Books', icon: '📖' },
      { name: 'Supplies', icon: '✏️' },
      { name: 'Tuition', icon: '🎓' },
    ]
  },
  { name: 'Other', icon: '📌', children: [] },
]

// ── Helpers ────────────────────────────────────────
async function getUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function mapCategory(c: any): CategoryData {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    budget: typeof c.budget === 'number' ? c.budget : 20000,
    parentId: c.parentId || null,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    children: (c.children || []).map(mapCategory),
  }
}

// ── Seed default categories ────────────────────────
export async function seedDefaultCategories(): Promise<CategoryData[]> {
  const userId = await getUserId()

  // Check if user already has categories
  const existing = await prisma.expenseCategory.findFirst({ where: { userId } })
  if (existing) {
    return getCategories()
  }

  // Create top-level categories + children
  for (let ti = 0; ti < DEFAULT_CATEGORIES.length; ti++) {
    const cat = DEFAULT_CATEGORIES[ti]
    const parent = await prisma.expenseCategory.create({
      data: { userId, name: cat.name, icon: cat.icon, sortOrder: ti },
    })
    for (let ci = 0; ci < cat.children.length; ci++) {
      const sub = cat.children[ci]
      await prisma.expenseCategory.create({
        data: { userId, name: sub.name, icon: sub.icon, parentId: parent.id, sortOrder: ci },
      })
    }
  }

  revalidatePath('/dashboard')
  return getCategories()
}

// ── Category CRUD ──────────────────────────────────
export async function getCategories(): Promise<CategoryData[]> {
  const userId = await getUserId()
  const cats = await prisma.expenseCategory.findMany({
    where: { userId },
    include: { children: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })
  // Only return top-level (no parentId)
  return cats.filter(c => !c.parentId).map(mapCategory)
}

export async function createCategory(
  name: string,
  icon: string,
  parentId?: string
): Promise<CategoryData> {
  const userId = await getUserId()

  // Get max sortOrder for the level
  const max = await prisma.expenseCategory.aggregate({
    where: { userId, parentId: parentId || null },
    _max: { sortOrder: true },
  })
  const sortOrder = (max._max.sortOrder ?? -1) + 1

  const cat = await prisma.expenseCategory.create({
    data: { userId, name, icon: icon || '📌', parentId: parentId || null, sortOrder },
    include: { children: true },
  })
  revalidatePath('/dashboard')
  return mapCategory(cat)
}

export async function updateCategory(
  id: string,
  name: string,
  icon: string,
  budget?: number
): Promise<CategoryData> {
  const userId = await getUserId()
  const data: any = { name, icon }
  if (typeof budget === 'number') data.budget = budget
  const cat = await prisma.expenseCategory.update({
    where: { id, userId },
    data,
    include: { children: true },
  })
  revalidatePath('/dashboard')
  return mapCategory(cat)
}

export async function saveCategoryBudgetByName(
  name: string,
  budget: number
): Promise<CategoryData | null> {
  const userId = await getUserId()
  const cat = await prisma.expenseCategory.updateMany({
    where: { userId, name },
    data: { budget },
  })
  revalidatePath('/dashboard')
  return null
}

export async function deleteCategory(id: string): Promise<boolean> {
  const userId = await getUserId()

  // Also delete subcategories
  await prisma.expenseCategory.deleteMany({ where: { userId, parentId: id } })
  await prisma.expenseCategory.delete({ where: { id, userId } })

  revalidatePath('/dashboard')
  return true
}

// ── Expense CRUD ───────────────────────────────────
export async function getExpenses(monthKey: string): Promise<ExpenseData[]> {
  const userId = await getUserId()
  const [year, month] = monthKey.split('-').map(Number)

  // monthKey is "YYYY-MM" where MM is 1-indexed. JS Date is 0-indexed for months.
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      category: { select: { name: true, icon: true } },
      subcategory: { select: { name: true, icon: true } },
    },
    orderBy: { date: 'desc' },
  })

  return expenses.map(e => ({
    id: e.id,
    categoryId: e.categoryId,
    subcategoryId: e.subcategoryId,
    amount: e.amount,
    date: e.date.toISOString().split('T')[0],
    note: e.note,
    categoryName: e.category.name,
    categoryIcon: e.category.icon,
    subcategoryName: e.subcategory?.name || null,
    subcategoryIcon: e.subcategory?.icon || null,
    createdAt: e.createdAt.toISOString(),
  }))
}

export async function createExpense(data: {
  categoryId: string
  subcategoryId?: string | null
  amount: number
  date: string
  note?: string
}): Promise<ExpenseData> {
  const userId = await getUserId()

  const expense = await prisma.expense.create({
    data: {
      userId,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId || null,
      amount: data.amount,
      date: new Date(data.date),
      note: data.note || '',
    },
    include: {
      category: { select: { name: true, icon: true } },
      subcategory: { select: { name: true, icon: true } },
    },
  })

  revalidatePath('/dashboard')
  return {
    id: expense.id,
    categoryId: expense.categoryId,
    subcategoryId: expense.subcategoryId,
    amount: expense.amount,
    date: expense.date.toISOString().split('T')[0],
    note: expense.note,
    categoryName: expense.category.name,
    categoryIcon: expense.category.icon,
    subcategoryName: expense.subcategory?.name || null,
    subcategoryIcon: expense.subcategory?.icon || null,
    createdAt: expense.createdAt.toISOString(),
  }
}

export async function updateExpense(
  id: string,
  data: {
    categoryId: string
    subcategoryId?: string | null
    amount: number
    date: string
    note?: string
  }
): Promise<ExpenseData> {
  const userId = await getUserId()

  const expense = await prisma.expense.update({
    where: { id, userId },
    data: {
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId || null,
      amount: data.amount,
      date: new Date(data.date),
      note: data.note || '',
    },
    include: {
      category: { select: { name: true, icon: true } },
      subcategory: { select: { name: true, icon: true } },
    },
  })

  revalidatePath('/dashboard')
  return {
    id: expense.id,
    categoryId: expense.categoryId,
    subcategoryId: expense.subcategoryId,
    amount: expense.amount,
    date: expense.date.toISOString().split('T')[0],
    note: expense.note,
    categoryName: expense.category.name,
    categoryIcon: expense.category.icon,
    subcategoryName: expense.subcategory?.name || null,
    subcategoryIcon: expense.subcategory?.icon || null,
    createdAt: expense.createdAt.toISOString(),
  }
}

export async function deleteExpenseAction(id: string): Promise<boolean> {
  const userId = await getUserId()
  await prisma.expense.delete({ where: { id, userId } })
  revalidatePath('/dashboard')
  return true
}