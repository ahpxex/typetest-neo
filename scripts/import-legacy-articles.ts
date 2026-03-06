import { basename, join } from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'

import { db } from '@/db/client'
import { articles } from '@/db/schema'
import { normalizeTypingText } from '@/modules/typing-engine'
import { slugify } from '@/lib/format'

const LEGACY_ARTICLE_DIR = join(process.cwd(), 'ref', 'typeeasy_final2022_10_18', 'continue')

const NAMED_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, entity) => NAMED_ENTITY_MAP[entity] ?? `&${entity};`)
}

function extractTitle(html: string, fileName: string) {
  const titleMatch = html.match(/<title>(.*?)\s*-\s*在线打字测试<\/title>/i)

  if (titleMatch?.[1]) {
    return decodeHtmlEntities(titleMatch[1]).trim()
  }

  return basename(fileName, '.html').replaceAll('_', ' ').trim()
}

function extractLanguage(html: string) {
  const typeMatch = html.match(/id="type" value="(en|zh|cn)"/i)

  if (!typeMatch) {
    return 'en' as const
  }

  return typeMatch[1].toLowerCase() === 'zh' || typeMatch[1].toLowerCase() === 'cn' ? 'zh' as const : 'en' as const
}

function extractSegments(html: string) {
  const segments: string[] = []
  const regex = /<div id="i_\d+"[\s\S]*?<input type="hidden" value="([^"]*)"[^>]*>/g

  for (const match of html.matchAll(regex)) {
    const value = match[1]
    if (!value) continue
    segments.push(decodeHtmlEntities(value))
  }

  return segments
}

function getLegacyArticleFiles() {
  return readdirSync(LEGACY_ARTICLE_DIR)
    .filter((fileName) => fileName.endsWith('.html'))
    .filter((fileName) => {
      const fullPath = join(LEGACY_ARTICLE_DIR, fileName)
      return statSync(fullPath).isFile()
    })
    .sort()
}

async function importLegacyArticles() {
  const articleFiles = getLegacyArticleFiles()
  let importedCount = 0

  for (const fileName of articleFiles) {
    const fullPath = join(LEGACY_ARTICLE_DIR, fileName)
    const html = readFileSync(fullPath, 'utf8')
    const title = extractTitle(html, fileName)
    const language = extractLanguage(html)
    const segments = extractSegments(html)
    const contentRaw = segments.join('').trim()

    if (!contentRaw) {
      console.warn(`Skipped ${fileName}: no content extracted`)
      continue
    }

    const contentNormalized = normalizeTypingText(contentRaw)
    const wordCount = contentNormalized.split(/\s+/).filter(Boolean).length
    const slug = slugify(basename(fileName, '.html'))
    const source = `legacy:${fileName}`

    await db.insert(articles).values({
      title,
      slug,
      language,
      contentRaw,
      contentNormalized,
      charCount: contentNormalized.length,
      wordCount,
      difficultyLevel: 1,
      source,
      status: 'published',
    }).onConflictDoUpdate({
      target: articles.slug,
      set: {
        title,
        language,
        contentRaw,
        contentNormalized,
        charCount: contentNormalized.length,
        wordCount,
        difficultyLevel: 1,
        source,
        status: 'published',
        updatedAt: new Date(),
      },
    })

    importedCount += 1
  }

  const allArticles = await db.select().from(articles)

  console.log(`Imported or updated ${importedCount} legacy articles.`)
  console.log(`Article library now contains ${allArticles.length} records.`)
  console.log(
    allArticles
      .sort((left, right) => left.slug.localeCompare(right.slug))
      .map((article) => `${article.slug} :: ${article.title}`)
      .join('\n'),
  )
}

importLegacyArticles().catch((error) => {
  console.error(error)
  process.exit(1)
})
