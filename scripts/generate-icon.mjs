import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import toIco from 'to-ico'
import sharp from 'sharp'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const pngPath = join(projectRoot, 'resources', 'branding', 'logo.png')
const icoPath = join(projectRoot, 'resources', 'branding', 'logo.ico')
const buildIcoPath = join(projectRoot, 'build', 'icon.ico')
const sizes = [16, 24, 32, 48, 64, 128, 256]

const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(pngPath).resize(size, size).png().toBuffer())
)

const icoBuffer = await toIco(pngBuffers)
mkdirSync(join(projectRoot, 'build'), { recursive: true })
writeFileSync(icoPath, icoBuffer)
writeFileSync(buildIcoPath, icoBuffer)
console.log(`Wrote ${icoPath} (${readFileSync(icoPath).length} bytes)`)
console.log(`Wrote ${buildIcoPath} (${readFileSync(buildIcoPath).length} bytes)`)
