import { copyFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outMain = join(root, 'out', 'main')

mkdirSync(outMain, { recursive: true })
copyFileSync(
  join(root, 'src', 'main', 'meet-caption-inject.js'),
  join(outMain, 'meet-caption-inject.js')
)
