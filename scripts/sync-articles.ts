import { db } from '@/db/client'
import { articles } from '@/db/schema'
import articleLibrary from '@/db/seeds/article-library.json'

type ArticleSeed = {
  title: string
  slug: string
  language: 'en' | 'zh'
  contentRaw: string
  contentNormalized: string
  charCount: number
  wordCount: number
  difficultyLevel: number
  source: string
}

async function syncArticles() {
  let syncedCount = 0

  for (const article of articleLibrary as ArticleSeed[]) {
    await db.insert(articles).values({
      title: article.title,
      slug: article.slug,
      language: article.language,
      contentRaw: article.contentRaw,
      contentNormalized: article.contentNormalized,
      charCount: article.charCount,
      wordCount: article.wordCount,
      difficultyLevel: article.difficultyLevel,
      source: article.source,
      status: 'published',
    }).onConflictDoUpdate({
      target: articles.slug,
      set: {
        title: article.title,
        language: article.language,
        contentRaw: article.contentRaw,
        contentNormalized: article.contentNormalized,
        charCount: article.charCount,
        wordCount: article.wordCount,
        difficultyLevel: article.difficultyLevel,
        source: article.source,
        status: 'published',
        updatedAt: new Date(),
      },
    })

    syncedCount += 1
  }

  const allArticles = await db.select().from(articles)

  console.log(`Synced ${syncedCount} article(s) from the bundled library.`)
  console.log(`Article library now contains ${allArticles.length} record(s).`)
}

syncArticles().catch((error) => {
  console.error(error)
  process.exit(1)
})
